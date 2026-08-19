"""Tests for the screening service.

These pin down what the service *does* claim, and just as importantly what it
does not. Several assertions here exist to stop a future change from quietly
promoting a weak measurement into something that drives a verdict.
"""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
from pypdf import PdfWriter

from app.main import app
from app.signals import Severity, Signal, band, score

client = TestClient(app)


def structured_image(size=(640, 480)) -> Image.Image:
    """An image with real structure.

    Smooth gradients defeat both perceptual hashing and ELA because there is
    almost nothing to measure, so fixtures need edges and shapes to be
    representative of a site photograph.
    """
    image = Image.new("RGB", size, (150, 150, 140))
    draw = ImageDraw.Draw(image)
    draw.rectangle([40, 300, 260, 460], fill=(90, 80, 70))
    draw.polygon([(300, 460), (420, 240), (540, 460)], fill=(120, 110, 95))
    draw.rectangle([480, 120, 520, 460], fill=(60, 60, 65))
    draw.ellipse([80, 60, 200, 180], fill=(200, 200, 190))
    return image


def as_jpeg(image: Image.Image, quality: int = 88) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=quality)
    return buffer.getvalue()


def screen(content: bytes, filename: str, content_type: str):
    return client.post(
        "/screen",
        files={"file": (filename, content, content_type)},
    )


class TestScoring:
    def test_info_signals_carry_no_weight(self):
        signals = [
            Signal(code="a", severity=Severity.INFO, summary=""),
            Signal(code="b", severity=Severity.INFO, summary=""),
        ]
        assert score(signals) == 0

    def test_one_high_outweighs_several_lows(self):
        highs = [Signal(code="h", severity=Severity.HIGH, summary="")]
        lows = [
            Signal(code=f"l{i}", severity=Severity.LOW, summary="") for i in range(3)
        ]
        assert score(highs) > score(lows)

    def test_score_saturates_rather_than_overflowing(self):
        many = [
            Signal(code=f"h{i}", severity=Severity.HIGH, summary="") for i in range(20)
        ]
        assert score(many) <= 100

    def test_bands(self):
        assert band(0) == "low"
        assert band(35) == "medium"
        assert band(85) == "high"


class TestImageScreening:
    def test_returns_hashes_and_never_a_verdict(self):
        response = screen(as_jpeg(structured_image()), "site.jpg", "image/jpeg")
        assert response.status_code == 200
        body = response.json()

        assert "sha256" in body["hashes"]
        assert "phash" in body["hashes"]
        # The contract is a score with reasons. A boolean verdict field would
        # invite callers to treat this as authoritative.
        assert "genuine" not in body
        assert "is_fake" not in body
        assert body["disclaimer"]

    def test_editing_software_is_flagged(self):
        image = structured_image()
        buffer = io.BytesIO()
        # Pillow writes the Software tag into the JPEG comment/EXIF path.
        exif = image.getexif()
        exif[0x0131] = "Adobe Photoshop 25.0"
        image.save(buffer, "JPEG", exif=exif)

        body = screen(buffer.getvalue(), "edited.jpg", "image/jpeg").json()
        codes = {s["code"] for s in body["signals"]}
        assert "editor_software" in codes
        assert body["risk"] > 0

    def test_ela_is_reported_but_never_scored(self):
        """Regression guard.

        ELA did not separate spliced from clean images on any fixture available
        during development, so it is emitted as information only. If someone
        later promotes it to a scored severity without validating it against
        real photographs, this fails.
        """
        body = screen(as_jpeg(structured_image()), "site.jpg", "image/jpeg").json()
        ela = [s for s in body["signals"] if s["code"].startswith("ela")]
        assert ela, "ELA should still be measured and surfaced"
        assert all(s["severity"] == "info" for s in ela)

    def test_ela_block_score_stays_finite_on_a_uniform_image(self):
        """Regression: a flat image drove MAD to zero and produced z ~ 1.2e6."""
        flat = Image.new("RGB", (320, 240), (128, 128, 128))
        body = screen(as_jpeg(flat), "flat.jpg", "image/jpeg").json()
        ela = next(s for s in body["signals"] if s["code"] == "ela_measured")
        assert 0 <= ela["data"]["ela_block_zmax"] < 1000

    def test_unreadable_file_is_reported_not_crashed(self):
        body = screen(b"this is not an image", "broken.jpg", "image/jpeg").json()
        assert body["analysed"] is False
        assert any(s["code"] == "unreadable" for s in body["signals"])


class TestReuseDetection:
    def test_recompressed_copy_is_recognised_as_the_same_image(self):
        original = structured_image()
        reused = original.resize((580, 435))

        a = screen(as_jpeg(original), "a.jpg", "image/jpeg").json()["hashes"]["phash"]
        b = screen(as_jpeg(reused, 70), "b.jpg", "image/jpeg").json()["hashes"]["phash"]

        result = client.post("/compare", data={"a": a, "b": b}).json()
        # Resubmitting an old photograph is the fraud that actually happens with
        # milestone evidence, and it is one of the few things this service can
        # assert with confidence.
        assert result["verdict"] == "near_identical"

    def test_different_scenes_are_not_confused(self):
        other = Image.new("RGB", (640, 480), (30, 60, 120))
        ImageDraw.Draw(other).ellipse([200, 150, 440, 390], fill=(240, 220, 90))

        a = screen(as_jpeg(structured_image()), "a.jpg", "image/jpeg").json()["hashes"]["phash"]
        b = screen(as_jpeg(other), "b.jpg", "image/jpeg").json()["hashes"]["phash"]

        result = client.post("/compare", data={"a": a, "b": b}).json()
        assert result["verdict"] == "different"


class TestPdfScreening:
    def _pdf(self, pages: int = 1) -> bytes:
        writer = PdfWriter()
        for _ in range(pages):
            writer.add_blank_page(width=595, height=842)
        buffer = io.BytesIO()
        writer.write(buffer)
        return buffer.getvalue()

    def test_reads_a_valid_pdf(self):
        body = screen(self._pdf(3), "tender.pdf", "application/pdf").json()
        assert body["analysed"] is True
        assert body["kind"] == "pdf"
        assert body["metadata"]["pages"] == 3

    def test_incremental_updates_are_flagged(self):
        # A real incremental update appends a body, xref and trailer after the
        # first %%EOF, which is how an edit-after-signing presents.
        base = self._pdf()
        doc = base + (
            b"\n4 0 obj\n<< /Type /Annot >>\nendobj\n"
            b"trailer\n<< /Size 5 /Prev 0 >>\nstartxref\n0\n%%EOF\n"
        )
        body = screen(doc, "amended.pdf", "application/pdf").json()
        codes = {s["code"] for s in body["signals"]}
        assert "incremental_updates" in codes

    def test_structural_findings_survive_an_unparseable_document(self):
        """A file that will not open is exactly when raw evidence matters."""
        doc = b"%PDF-1.4 broken\n/JavaScript (app.alert)\n%%EOF\n%%EOF\n"
        body = screen(doc, "hostile.pdf", "application/pdf").json()
        codes = {s["code"] for s in body["signals"]}
        assert body["analysed"] is False
        assert "unreadable" in codes
        assert "embedded_javascript" in codes
        assert "incremental_updates" in codes

    def test_unreadable_pdf_is_reported(self):
        body = screen(b"%PDF-1.4 truncated", "broken.pdf", "application/pdf").json()
        assert body["analysed"] is False


class TestUnsupportedTypes:
    def test_video_is_acknowledged_not_silently_passed(self):
        body = screen(b"\x00\x00\x00\x20ftypmp42", "clip.mp4", "video/mp4").json()
        assert body["analysed"] is False
        codes = {s["code"] for s in body["signals"]}
        # Saying nothing would imply the footage had been checked.
        assert "video_not_screened" in codes
        assert body["hashes"]["sha256"]

    def test_unknown_type_still_returns_a_hash(self):
        body = screen(b"anything", "x.bin", "application/octet-stream").json()
        assert body["hashes"]["sha256"]
        assert body["risk"] == 0
