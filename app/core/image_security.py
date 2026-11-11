"""
Screenshot & Image Security Validation Module (SEC-06).
Implements strict base64 decoding, MIME & magic-byte sniffing, decoded size caps,
image dimension/pixel limits against decompression bombs, and SHA-256 manifests.
"""

import io
import re
import base64
from dataclasses import dataclass
from typing import Dict, Any, Tuple
from PIL import Image, UnidentifiedImageError

from app.config import settings
from app.core.network_intel import create_evidence_manifest

ALLOWED_FORMATS: Dict[str, str] = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
}

DATA_URI_PREFIX_RE = re.compile(
    r"^data:(?P<mime>[a-zA-Z0-9.+/-]+);base64,(?P<data>.+)$",
    re.DOTALL,
)

ALLOWED_HEADER_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


class ImageValidationError(Exception):
    """Raised when an uploaded image fails security validation."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class ValidatedImage:
    raw_bytes: bytes
    mime_type: str
    image_format: str
    width: int
    height: int
    size_bytes: int
    sha256_hash: str
    manifest: Dict[str, Any]


def _sniff_magic_bytes(data: bytes) -> str:
    """Identifies image format strictly from binary magic bytes."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    if data.startswith(b"\xff\xd8\xff"):
        return "JPEG"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"
    raise ImageValidationError(
        "Format file ditolak: isi berkas bukan gambar PNG, JPEG, atau WEBP yang valid.",
        status_code=400,
    )


def _strip_and_validate_base64_prefix(payload: str) -> str:
    stripped = (payload or "").strip()
    if not stripped:
        raise ImageValidationError("Data gambar base64 kosong.", status_code=400)

    if stripped.startswith("data:"):
        match = DATA_URI_PREFIX_RE.match(stripped)
        if not match:
            raise ImageValidationError(
                "Format Data URI tidak valid. Harus berupa base64 gambar PNG, JPEG, atau WEBP.",
                status_code=400,
            )
        declared_mime = match.group("mime").lower()
        if declared_mime not in ALLOWED_HEADER_MIMES:
            raise ImageValidationError(
                f"Tipe MIME '{declared_mime}' tidak diizinkan. Gunakan PNG, JPEG, atau WEBP.",
                status_code=400,
            )
        return match.group("data").strip()

    return stripped


def validate_and_inspect_image(image_base64: str) -> ValidatedImage:
    """
    Validates base64 image payload defensively:
    1. Rejects malformed Data URI / disallowed declared MIME types (e.g. SVG/HTML).
    2. Pre-checks encoded length and enforces strict base64 decoding.
    3. Enforces max decoded size limit (MAX_IMAGE_SIZE_BYTES).
    4. Performs magic-byte content sniffing + Pillow container verification.
    5. Enforces width/height/total-pixel boundaries against decompression bombs.
    6. Generates full SHA-256 hash and canonical forensic manifest.
    """
    encoded_data = _strip_and_validate_base64_prefix(image_base64)

    # Rough encoded ceiling before allocating decoded bytes
    max_encoded_len = ((settings.MAX_IMAGE_SIZE_BYTES + 2) // 3) * 4 + 64
    if len(encoded_data) > max_encoded_len:
        raise ImageValidationError(
            f"Ukuran gambar melebihi batas maksimum ({settings.MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB).",
            status_code=413,
        )

    try:
        # Remove internal newlines allowed in MIME base64 wrappers, then decode strictly
        compact = "".join(encoded_data.split())
        raw_bytes = base64.b64decode(compact, validate=True)
    except Exception:
        raise ImageValidationError("Encoding base64 gambar tidak valid atau rusak.", status_code=400)

    size_bytes = len(raw_bytes)
    if size_bytes == 0:
        raise ImageValidationError("Isi gambar kosong setelah dekode.", status_code=400)
    if size_bytes > settings.MAX_IMAGE_SIZE_BYTES:
        raise ImageValidationError(
            f"Ukuran gambar melebihi batas maksimum ({settings.MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB).",
            status_code=413,
        )

    sniffed_format = _sniff_magic_bytes(raw_bytes)

    # Protect Pillow against decompression bombs during verification
    previous_max_pixels = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_PIXELS
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            detected_format = (img.format or "").upper()
            width, height = img.size

            if detected_format not in ALLOWED_FORMATS or detected_format != sniffed_format:
                raise ImageValidationError(
                    "Struktur gambar tidak konsisten dengan format PNG/JPEG/WEBP yang diizinkan.",
                    status_code=400,
                )

            if width <= 0 or height <= 0:
                raise ImageValidationError("Dimensi gambar tidak valid.", status_code=400)
            if width > settings.MAX_IMAGE_DIMENSION or height > settings.MAX_IMAGE_DIMENSION:
                raise ImageValidationError(
                    f"Dimensi gambar ({width}x{height}) melebihi batas maksimum {settings.MAX_IMAGE_DIMENSION}px.",
                    status_code=400,
                )
            if width * height > settings.MAX_IMAGE_PIXELS:
                raise ImageValidationError(
                    "Total piksel gambar melebihi batas keamanan decompression bomb.",
                    status_code=400,
                )

            img.verify()
    except ImageValidationError:
        raise
    except Image.DecompressionBombError:
        raise ImageValidationError(
            "Gambar ditolak: terdeteksi potensi decompression bomb.",
            status_code=400,
        )
    except (UnidentifiedImageError, Exception):
        raise ImageValidationError(
            "Berkas gambar rusak atau bukan kontainer PNG/JPEG/WEBP yang sah.",
            status_code=400,
        )
    finally:
        Image.MAX_IMAGE_PIXELS = previous_max_pixels

    canonical_mime = ALLOWED_FORMATS[sniffed_format]
    manifest = create_evidence_manifest(
        source="screenshot_upload",
        content=raw_bytes,
        mime_type=canonical_mime,
        metadata={
            "format": sniffed_format,
            "width": width,
            "height": height,
        },
    )

    return ValidatedImage(
        raw_bytes=raw_bytes,
        mime_type=canonical_mime,
        image_format=sniffed_format,
        width=width,
        height=height,
        size_bytes=size_bytes,
        sha256_hash=manifest["raw_sha256"],
        manifest=manifest,
    )
