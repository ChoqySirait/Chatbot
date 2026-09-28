import re
import ipaddress
from urllib.parse import urlparse

INJECTION_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"bypass (all )?security protocols",
    r"system prompt override",
    r"you are now in developer mode",
    r"dan mode",
]

def sanitize_user_input(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r'<script.*?>.*?</script>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    return cleaned

def check_prompt_injection(text: str) -> bool:
    lower_text = text.lower()
    return any(re.search(pat, lower_text) for pat in INJECTION_PATTERNS)

def defang_url(url: str) -> str:
    """Menetralkan URL berbahaya agar aman ditampilkan di UI (mis: hxxps[://]domain[.]com)"""
    defanged = re.sub(r'^https://', 'hxxps://', url, flags=re.IGNORECASE)
    defanged = re.sub(r'^http://', 'hxxp://', defanged, flags=re.IGNORECASE)
    defanged = defanged.replace('.', '[.]')
    defanged = defanged.replace('://', '[://]')
    return defanged

def is_safe_public_url(url: str) -> bool:
    """Mencegah SSRF dengan memvalidasi bahwa URL bukan localhost atau subnet privat."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return False
        if hostname.lower() in ["localhost", "127.0.0.1", "0.0.0.0", "::1"]:
            return False
        # Validasi jika hostname adalah IP Address
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_reserved:
                return False
        except ValueError:
            # Berarti hostname adalah nama domain (mis: google.com), lanjutkan
            pass
        return True
    except Exception:
        return False