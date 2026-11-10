"""
Logging Configuration & Privacy Redaction Module.
Ensures structured, informative operational logging without recording
sensitive credentials, API keys, or raw confidential payloads (Epic 1: SEC-07).
"""

import re
import logging
import sys

# Pola data sensitif yang harus diredaksi dari log
SENSITIVE_PATTERNS = [
    re.compile(r'(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["\']?([^"\'\s]+)["\']?', re.IGNORECASE),
    re.compile(r'bearer\s+([a-zA-Z0-9_\-\.]+)', re.IGNORECASE)
]


class PrivacyFilter(logging.Filter):
    """Filter untuk meredaksi token, API key, dan password dari pesan log."""
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            msg = record.msg
            for pattern in SENSITIVE_PATTERNS:
                msg = pattern.sub(r'\1=***REDACTED***', msg)
            record.msg = msg
        return True


def setup_logging(level: int = logging.INFO) -> None:
    """Menginisialisasi konfigurasi logging terpusat aplikasi."""
    root_logger = logging.getLogger()
    if root_logger.handlers:
        return

    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    handler.addFilter(PrivacyFilter())

    root_logger.setLevel(level)
    root_logger.addHandler(handler)

    # Turunkan verbositas modul eksternal
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
