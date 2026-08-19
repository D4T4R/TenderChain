"""PDF structural forensics.

For tender documents the useful signals are structural rather than visual. A PDF
records how it was produced and, crucially, whether it has been modified after
signing: incremental updates append to the file rather than rewriting it, so an
edited document carries its own history.

As with images these are prompts, not proof. Many are routine: a document
assembled from scans legitimately has many images, and adding a signature page
legitimately creates an incremental update.
"""

from __future__ import annotations

import io
import re
from typing import Any, Dict, List

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from .signals import Severity, Signal

EDITOR_MARKERS = (
    "photoshop",
    "illustrator",
    "gimp",
    "inkscape",
    "libreoffice draw",
    "pdf-xchange",
    "foxit phantom",
    "nitro pro",
    "pdfescape",
    "ilovepdf",
    "smallpdf",
)

# Producers typical of a document that was printed and rescanned, which erases
# the original's structure and is a common way to launder an edit.
SCANNER_MARKERS = ("scan", "canoscan", "epson", "xerox", "kyocera")


def _count_incremental_updates(content: bytes) -> int:
    """Each %%EOF beyond the first indicates an appended revision."""
    return max(0, len(re.findall(rb"%%EOF", content)) - 1)


def _raw_signals(content: bytes) -> List[Signal]:
    """Structural checks that read the bytes directly.

    Run before and independently of parsing: a PDF that pypdf cannot open is
    exactly the case where raw evidence matters most, and returning only
    "unreadable" would discard it.
    """
    signals: List[Signal] = []

    revisions = _count_incremental_updates(content)
    if revisions > 0:
        signals.append(
            Signal(
                code="incremental_updates",
                severity=Severity.MEDIUM if revisions > 1 else Severity.LOW,
                summary="Document was modified after it was first written",
                detail=(
                    f"{revisions} appended revision(s) found. Signing or "
                    "annotating a PDF does this legitimately, but so does "
                    "altering content after approval."
                ),
                data={"revisions": revisions},
            )
        )

    # Embedded JavaScript has no place in a tender document and is a red flag
    # both for tampering and for plain malware.
    if b"/JavaScript" in content or b"/JS" in content:
        signals.append(
            Signal(
                code="embedded_javascript",
                severity=Severity.HIGH,
                summary="Document contains embedded JavaScript",
                detail=(
                    "Tender documents should be static. Embedded scripts can "
                    "alter what a reader sees, and are a common malware vector."
                ),
            )
        )

    if b"/EmbeddedFile" in content:
        signals.append(
            Signal(
                code="embedded_files",
                severity=Severity.MEDIUM,
                summary="Document has other files attached inside it",
                detail="Attachments travel with the document and are easy to miss.",
            )
        )

    return signals


def analyse(content: bytes, filename: str = "") -> Dict[str, Any]:
    signals: List[Signal] = _raw_signals(content)

    try:
        reader = PdfReader(io.BytesIO(content))
        page_count = len(reader.pages)
    except (PdfReadError, OSError, ValueError) as exc:
        signals.append(
            Signal(
                code="unreadable",
                severity=Severity.MEDIUM,
                summary="File could not be parsed as a PDF",
                detail=(
                    f"{exc}. A document that will not open cleanly is itself "
                    "worth a look; any structural findings above still stand."
                ),
            )
        )
        return {
            "kind": "pdf",
            "analysed": False,
            "signals": [s.to_dict() for s in signals],
            "hashes": {},
            "metadata": {"revisions": _count_incremental_updates(content)},
        }

    info = {}
    try:
        if reader.metadata:
            info = {
                str(k).lstrip("/"): str(v) for k, v in dict(reader.metadata).items()
            }
    except Exception:
        info = {}

    producer = (info.get("Producer", "") or "").lower()
    creator = (info.get("Creator", "") or "").lower()

    revisions = _count_incremental_updates(content)

    if any(marker in producer or marker in creator for marker in EDITOR_MARKERS):
        signals.append(
            Signal(
                code="graphics_editor_producer",
                severity=Severity.MEDIUM,
                summary="Produced by a graphics or PDF editing tool",
                detail=(
                    f"Producer '{producer or 'unknown'}', creator "
                    f"'{creator or 'unknown'}'. Official documents are normally "
                    "exported from an office suite or a document system."
                ),
                data={"producer": producer, "creator": creator},
            )
        )

    if any(marker in producer for marker in SCANNER_MARKERS):
        signals.append(
            Signal(
                code="scanned_document",
                severity=Severity.LOW,
                summary="Appears to be a scan rather than a native export",
                detail=(
                    "Scanning discards the original document structure, so "
                    "later edits cannot be detected from the file itself."
                ),
                data={"producer": producer},
            )
        )

    if producer and creator and producer.split()[0] != creator.split()[0]:
        signals.append(
            Signal(
                code="producer_creator_mismatch",
                severity=Severity.LOW,
                summary="Created and exported by different tools",
                detail=f"Creator '{creator}', producer '{producer}'.",
                data={"producer": producer, "creator": creator},
            )
        )

    if not info:
        signals.append(
            Signal(
                code="metadata_absent",
                severity=Severity.LOW,
                summary="Document carries no metadata",
                detail="Common after a scan or a metadata-stripping export.",
            )
        )

    if reader.is_encrypted:
        signals.append(
            Signal(
                code="encrypted",
                severity=Severity.LOW,
                summary="Document is encrypted",
                detail="Content could not be inspected fully.",
            )
        )

    if page_count == 0:
        signals.append(
            Signal(
                code="no_pages",
                severity=Severity.MEDIUM,
                summary="Document has no pages",
            )
        )

    return {
        "kind": "pdf",
        "analysed": True,
        "signals": [s.to_dict() for s in signals],
        "hashes": {},
        "metadata": {
            "pages": page_count,
            "producer": info.get("Producer"),
            "creator": info.get("Creator"),
            "created": info.get("CreationDate"),
            "modified": info.get("ModDate"),
            "revisions": revisions,
            "encrypted": reader.is_encrypted,
        },
    }
