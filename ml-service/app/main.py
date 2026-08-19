"""TenderChain artefact screening service.

Screens documents and milestone evidence before they are pinned to IPFS and
anchored on chain, and returns an explainable risk assessment.

What this service does NOT do, deliberately:

  * decide whether a document is genuine or forged. That is not a solved
    problem, and a wrong answer is harmful in both directions - a false
    "genuine" launders a forged completion certificate into a permanent record,
    and a false "fake" blocks a legitimate contractor's payment;
  * block anything. It returns an assessment; the caller uploads regardless and
    routes anything notable to a human verifier.

The strongest integrity guarantee in this system is not here at all: it is the
content hash pinned to IPFS and anchored on chain, which makes tampering after
upload detectable with certainty. This service only screens for manipulation
that happened before the file arrived.
"""

from __future__ import annotations

import hashlib
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import image_forensics, pdf_forensics
from .signals import Severity, Signal, band, score

SERVICE_VERSION = "0.1.0"
MAX_BYTES = int(os.getenv("SCREENING_MAX_BYTES", str(25 * 1024 * 1024)))

app = FastAPI(
    title="TenderChain screening",
    version=SERVICE_VERSION,
    description=(
        "Advisory manipulation screening for tender documents and milestone "
        "artefacts. Returns risk signals, never a genuine/fake verdict."
    ),
)

IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff"}
PDF_TYPES = {"application/pdf"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-matroska", "video/webm"}


class ScreeningResult(BaseModel):
    risk: int
    band: str
    kind: str
    analysed: bool
    signals: List[Dict[str, Any]]
    hashes: Dict[str, str]
    metadata: Dict[str, Any] = {}
    service_version: str
    duration_ms: int
    disclaimer: str


DISCLAIMER = (
    "Advisory only. These signals indicate where a human should look; they do "
    "not establish that a document is genuine or forged."
)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "screening", "version": SERVICE_VERSION}


def _video_signals() -> List[Signal]:
    """Video is acknowledged rather than analysed.

    Frame-level forensics on video needs decoding infrastructure this service
    does not carry, and half-analysing it would imply a level of assurance that
    is not there. The content hash and chain anchor still apply.
    """
    return [
        Signal(
            code="video_not_screened",
            severity=Severity.INFO,
            summary="Video content is not screened for manipulation",
            detail=(
                "Only its hash is recorded. The IPFS anchor still makes any "
                "change after upload detectable; nothing is asserted about the "
                "footage itself."
            ),
        )
    ]


@app.post("/screen", response_model=ScreeningResult)
async def screen(
    file: UploadFile = File(...),
    declared_type: Optional[str] = Form(None),
) -> Any:
    started = time.perf_counter()
    content = await file.read()

    if len(content) > MAX_BYTES:
        return JSONResponse(
            status_code=413,
            content={"error": f"File exceeds {MAX_BYTES} bytes"},
        )

    content_type = (declared_type or file.content_type or "").lower()
    sha256 = hashlib.sha256(content).hexdigest()

    if content_type in IMAGE_TYPES:
        result = image_forensics.analyse(content, file.filename or "")
    elif content_type in PDF_TYPES:
        result = pdf_forensics.analyse(content, file.filename or "")
    elif content_type in VIDEO_TYPES:
        result = {
            "kind": "video",
            "analysed": False,
            "signals": [s.to_dict() for s in _video_signals()],
            "hashes": {},
            "metadata": {},
        }
    else:
        result = {
            "kind": "other",
            "analysed": False,
            "signals": [
                Signal(
                    code="unsupported_type",
                    severity=Severity.INFO,
                    summary="No screening available for this file type",
                    detail=f"Declared type '{content_type or 'unknown'}'.",
                ).to_dict()
            ],
            "hashes": {},
            "metadata": {},
        }

    # Reconstruct signal objects only to score them; the wire format stays dicts.
    signals = [
        Signal(
            code=s["code"],
            severity=Severity(s["severity"]),
            summary=s["summary"],
            detail=s.get("detail", ""),
            data=s.get("data", {}),
        )
        for s in result["signals"]
    ]

    risk = score(signals)
    hashes = {"sha256": sha256, **result.get("hashes", {})}

    return ScreeningResult(
        risk=risk,
        band=band(risk),
        kind=result["kind"],
        analysed=result["analysed"],
        signals=result["signals"],
        hashes=hashes,
        metadata=result.get("metadata", {}),
        service_version=SERVICE_VERSION,
        duration_ms=int((time.perf_counter() - started) * 1000),
        disclaimer=DISCLAIMER,
    )


@app.post("/compare")
async def compare(a: str = Form(...), b: str = Form(...)) -> Dict[str, Any]:
    """Perceptual-hash distance, for detecting reuse of an earlier artefact.

    Reuse is the fraud that actually occurs with milestone evidence -
    resubmitting an old photograph - and it is one of the few things this
    service can assert with reasonable confidence.
    """
    try:
        distance = image_forensics.hamming_distance(a, b)
    except Exception as exc:  # noqa: BLE001 - malformed input from the caller
        return JSONResponse(status_code=400, content={"error": str(exc)})

    # Thresholds from common practice with 64-bit pHash: identical images are 0,
    # re-encodes and light crops stay in single digits, unrelated images sit
    # well above 20.
    if distance <= 4:
        verdict, note = "near_identical", "Almost certainly the same image."
    elif distance <= 10:
        verdict, note = "similar", "Likely the same scene, possibly re-encoded or cropped."
    else:
        verdict, note = "different", "No meaningful resemblance."

    return {"distance": distance, "verdict": verdict, "note": note}
