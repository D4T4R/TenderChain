"""Image manipulation forensics.

Every check here detects *evidence of editing*, not forgery. A photo can be
resaved, cropped or colour-corrected for entirely innocent reasons, and a site
engineer's phone may strip metadata by default. The output is therefore a set of
reasons for a human to look closer, weighted so that no single observation
condemns an artefact.

Techniques and their honest limits:

- Error Level Analysis compares a JPEG against a known-quality recompression.
  Spliced regions can show different error levels because they have been
  through a different compression history.

  It is reported but deliberately NOT scored. On the fixtures available during
  development it failed to separate a spliced image from a clean one: a
  full-quality resave raised the error floor everywhere, and a same-quality
  splice produced a robust z-score of 3.8 against 3.7 for the untouched
  original - indistinguishable from noise. ELA needs high-frequency texture to
  work and is defeated by a single resave, so scoring it here would manufacture
  confidence that the measurement does not support. The numbers are surfaced
  for a forensic analyst who wants them; they must not drive a verdict until
  validated against real photographs.
- Metadata checks are the most actionable in practice: editing software usually
  announces itself.
- Perceptual hashing does not detect manipulation at all; it detects *reuse*,
  which in a milestone-evidence context is the fraud that actually happens -
  submitting last month's photo again.
"""

from __future__ import annotations

import io
import math
from typing import Any, Dict, List, Tuple

import imagehash
import numpy as np
from PIL import Image, ImageChops, UnidentifiedImageError
from PIL.ExifTags import TAGS

from .signals import Severity, Signal

# Software names that indicate an image passed through an editor. Presence is
# not proof of anything - a photo may be legitimately cropped or rotated - but
# it is worth a verifier knowing.
EDITOR_MARKERS = (
    "photoshop",
    "gimp",
    "lightroom",
    "affinity",
    "pixelmator",
    "paint.net",
    "snapseed",
    "picsart",
    "facetune",
    "remini",
)

# Generators whose output is synthetic rather than photographic.
SYNTHETIC_MARKERS = ("dall-e", "midjourney", "stable diffusion", "firefly")


def _exif(image: Image.Image) -> Dict[str, Any]:
    try:
        raw = image._getexif()  # noqa: SLF001 - Pillow exposes no public API
    except Exception:
        return {}
    if not raw:
        return {}
    return {TAGS.get(tag, tag): value for tag, value in raw.items()}


def _error_level_analysis(
    image: Image.Image, quality: int = 90, block: int = 16
) -> Tuple[float, float, float]:
    """Return (mean, p99, peak block z-score) of the ELA difference.

    The block z-score is a robust (median/MAD) measure of how far the most
    unusual 16x16 region sits from the rest of the image, which is the shape a
    splice would take. Reported, not scored - see the module docstring.
    """
    rgb = image.convert("RGB")

    buffer = io.BytesIO()
    rgb.save(buffer, "JPEG", quality=quality)
    buffer.seek(0)
    recompressed = Image.open(buffer)

    diff = ImageChops.difference(rgb, recompressed)
    array = np.asarray(diff, dtype=np.float32).max(axis=2)

    if array.size == 0:
        return 0.0, 0.0, 0.0

    height, width = array.shape
    rows, cols = height // block, width // block
    zmax = 0.0
    if rows and cols:
        blocks = array[: rows * block, : cols * block].reshape(
            rows, block, cols, block
        ).mean(axis=(1, 3))
        median = float(np.median(blocks))
        mad = float(np.median(np.abs(blocks - median)))
        # ELA values are 0-255 integers, so a MAD below half a level means the
        # image is essentially uniform and the ratio is meaningless. Flooring at
        # a tiny epsilon instead produced z-scores in the millions on flat
        # images - a number that looks alarming and means nothing.
        if mad < 0.5:
            zmax = 0.0
        else:
            zmax = float(((blocks - median) / (1.4826 * mad)).max())

    return float(array.mean()), float(np.percentile(array, 99)), zmax


def _analyse_metadata(exif: Dict[str, Any], signals: List[Signal]) -> None:
    software = str(exif.get("Software", "") or "").lower()
    if software:
        if any(marker in software for marker in SYNTHETIC_MARKERS):
            signals.append(
                Signal(
                    code="synthetic_generator",
                    severity=Severity.HIGH,
                    summary="Metadata names an image generator",
                    detail=f"Software tag reads '{software}'.",
                    data={"software": software},
                )
            )
        elif any(marker in software for marker in EDITOR_MARKERS):
            signals.append(
                Signal(
                    code="editor_software",
                    severity=Severity.MEDIUM,
                    summary="Image was saved by editing software",
                    detail=(
                        f"Software tag reads '{software}'. Cropping or rotating "
                        "leaves the same trace, so this is a prompt to look, not "
                        "evidence of tampering."
                    ),
                    data={"software": software},
                )
            )

    has_camera = bool(exif.get("Make") or exif.get("Model"))
    has_capture_time = bool(exif.get("DateTimeOriginal"))

    if exif and not has_camera:
        signals.append(
            Signal(
                code="no_camera_metadata",
                severity=Severity.LOW,
                summary="No camera make or model recorded",
                detail=(
                    "Site photographs normally carry camera details. Messaging "
                    "apps and screenshots routinely strip them, so this is weak "
                    "on its own."
                ),
            )
        )

    if not exif:
        signals.append(
            Signal(
                code="metadata_absent",
                severity=Severity.LOW,
                summary="Image carries no metadata at all",
                detail=(
                    "Consistent with a screenshot, a re-export, or delivery "
                    "through an app that strips metadata."
                ),
            )
        )

    if has_capture_time:
        signals.append(
            Signal(
                code="capture_time_present",
                severity=Severity.INFO,
                summary="Capture time recorded",
                detail=str(exif.get("DateTimeOriginal")),
                data={"captured_at": str(exif.get("DateTimeOriginal"))},
            )
        )

    gps = exif.get("GPSInfo")
    signals.append(
        Signal(
            code="gps_present" if gps else "gps_absent",
            severity=Severity.INFO if gps else Severity.LOW,
            summary=(
                "Location recorded with the photograph"
                if gps
                else "No location recorded"
            ),
            detail=(
                "Location can corroborate that work was photographed on site."
                if gps
                else "Without location, the photograph cannot be tied to the work site."
            ),
        )
    )


def analyse(content: bytes, filename: str = "") -> Dict[str, Any]:
    """Screen an image. Returns signals plus hashes for the caller to store."""
    signals: List[Signal] = []

    try:
        image = Image.open(io.BytesIO(content))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        return {
            "kind": "image",
            "analysed": False,
            "signals": [
                Signal(
                    code="unreadable",
                    severity=Severity.MEDIUM,
                    summary="File could not be read as an image",
                    detail=str(exc),
                ).to_dict()
            ],
            "hashes": {},
        }

    width, height = image.size
    exif = _exif(image)
    _analyse_metadata(exif, signals)

    # ELA only means anything for lossy formats with a compression history.
    if (image.format or "").upper() in {"JPEG", "JPG"}:
        mean, p99, zmax = _error_level_analysis(image)
        signals.append(
            Signal(
                # Informational by design - see the module docstring. This
                # measurement did not separate spliced from clean images on the
                # available fixtures, so it carries no weight in the score.
                code="ela_measured",
                severity=Severity.INFO,
                summary="Compression error measured (not scored)",
                detail=(
                    f"Mean {mean:.1f}, top percentile {p99:.1f}, peak block "
                    f"z-score {zmax:.1f}. Provided for forensic review; this "
                    "measure is unvalidated on real photographs and is "
                    "deliberately excluded from the risk score."
                ),
                data={
                    "ela_mean": round(mean, 2),
                    "ela_p99": round(p99, 2),
                    "ela_block_zmax": round(zmax, 2),
                },
            )
        )
    else:
        signals.append(
            Signal(
                code="ela_not_applicable",
                severity=Severity.INFO,
                summary="Compression analysis does not apply to this format",
                detail=f"Format is {image.format}; error level analysis needs JPEG.",
            )
        )

    if width * height < 240 * 240:
        signals.append(
            Signal(
                code="very_low_resolution",
                severity=Severity.LOW,
                summary="Image is very small",
                detail=(
                    f"{width}x{height}. Detail may be insufficient to evidence "
                    "the work, and downscaling destroys manipulation traces."
                ),
                data={"width": width, "height": height},
            )
        )

    # Perceptual hash is returned rather than judged: reuse can only be
    # detected against artefacts the caller already holds.
    grey = image.convert("L")
    hashes = {
        "phash": str(imagehash.phash(grey)),
        "dhash": str(imagehash.dhash(grey)),
    }

    return {
        "kind": "image",
        "analysed": True,
        "signals": [s.to_dict() for s in signals],
        "hashes": hashes,
        "metadata": {
            "width": width,
            "height": height,
            "format": image.format,
            "mode": image.mode,
            "has_exif": bool(exif),
        },
    }


def hamming_distance(a: str, b: str) -> int:
    """Distance between two perceptual hashes, for reuse detection."""
    return imagehash.hex_to_hash(a) - imagehash.hex_to_hash(b)
