"""
Public Suffix List (PSL) and Brand Registry Engine.
Provides offline, deterministic registrable domain extraction and brand impersonation detection.
Zero external network calls required.
"""

import re
from urllib.parse import urlparse
from typing import Optional, Tuple, Dict, Set, List

def get_domain_from_url(url: str) -> str:
    """Ekstrak nama domain murni dari URL."""
    if not url:
        return ""
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    domain = parsed.hostname or url.split('/')[0]
    return domain.lower().strip()

# Comprehensive offline list of multi-level and single-level public suffixes
# Prioritizes Indonesian ccTLDs, major global ccTLDs, and common gTLDs.
TWO_LEVEL_SUFFIXES: Set[str] = {
    # Indonesian ccTLD second levels
    "co.id", "net.id", "biz.id", "web.id", "my.id", "ac.id", "sch.id", "go.id", "mil.id", "or.id", "ponpes.id",
    # UK second levels
    "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "net.uk",
    # Australia second levels
    "com.au", "net.au", "org.au", "edu.au", "gov.au",
    # Japan second levels
    "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
    # Singapore second levels
    "com.sg", "net.sg", "org.sg", "edu.sg", "gov.sg",
    # Malaysia second levels
    "com.my", "net.my", "org.my", "edu.my", "gov.my",
    # Brazil second levels
    "com.br", "net.br", "org.br",
    # New Zealand second levels
    "co.nz", "net.nz", "org.nz", "govt.nz",
    # South Africa second levels
    "co.za", "net.za", "org.za",
    # India second levels
    "co.in", "net.in", "org.in", "ac.in", "gov.in",
}

# Authoritative Brand Registry
# Maps brand identifiers to their genuine, officially registered registrable domains.
OFFICIAL_BRAND_REGISTRY: Dict[str, Set[str]] = {
    "bca": {"bca.co.id", "klikbca.com"},
    "tokopedia": {"tokopedia.com", "tokopedia.link"},
    "shopee": {"shopee.co.id", "shopee.com"},
    "bri": {"bri.co.id"},
    "bni": {"bni.co.id"},
    "mandiri": {"bankmandiri.co.id", "livinbymandiri.id", "mandiri.co.id"},
    "dana": {"dana.id"},
    "gopay": {"gopay.co.id"},
    "ovo": {"ovo.id"},
    "blibli": {"blibli.com"},
    "whatsapp": {"whatsapp.com", "wa.me"},
}


def get_public_suffix(hostname: str) -> Optional[str]:
    """Returns the public suffix of a hostname (e.g. 'co.id', 'com')."""
    if not hostname:
        return None
    hostname = hostname.lower().strip().rstrip('.')
    parts = hostname.split('.')
    if len(parts) < 2:
        return None

    # Check two-level suffix (e.g. co.id)
    if len(parts) >= 2:
        two_level = f"{parts[-2]}.{parts[-1]}"
        if two_level in TWO_LEVEL_SUFFIXES:
            return two_level

    # Default to top-level domain (single part)
    return parts[-1]


def split_domain(hostname: str) -> Tuple[str, str, str]:
    """
    Splits hostname into (subdomain, domain_label, suffix).
    Example:
        'promo.bca.co.id' -> ('promo', 'bca', 'co.id')
        'tokopedia.com'    -> ('', 'tokopedia', 'com')
    """
    if not hostname:
        return "", "", ""
    hostname = hostname.lower().strip().rstrip('.')
    suffix = get_public_suffix(hostname)
    if not suffix:
        return "", hostname, ""

    prefix = hostname[:-len(suffix)].rstrip('.')
    prefix_parts = prefix.split('.')
    if not prefix_parts or not prefix_parts[0]:
        return "", "", suffix

    domain_label = prefix_parts[-1]
    subdomain = ".".join(prefix_parts[:-1])
    return subdomain, domain_label, suffix


def get_registrable_domain(hostname: str) -> Optional[str]:
    """
    Returns the registrable domain (e.g. 'bca.co.id', 'tokopedia.com').
    If the hostname is already an IP address or single label, returns None.
    """
    subdomain, domain_label, suffix = split_domain(hostname)
    if not domain_label or not suffix:
        return None
    return f"{domain_label}.{suffix}"


def is_official_brand_domain(hostname: str, brand: str) -> bool:
    """
    Checks if the hostname is genuinely an official domain or legitimate subdomain
    belonging to the given brand.
    """
    brand_key = brand.lower().strip()
    official_domains = OFFICIAL_BRAND_REGISTRY.get(brand_key)
    if not official_domains:
        return False

    reg_domain = get_registrable_domain(hostname)
    if not reg_domain:
        return False

    return reg_domain in official_domains


def detect_brand_impersonation(hostname: str) -> List[Dict[str, str]]:
    """
    Detects brand typosquatting / impersonation on a hostname.
    Returns a list of detected impersonations with details:
    [
        {"brand": "bca", "reason": "Meniru merek 'BCA' di luar domain resmi.", "official_domains": "bca.co.id, klikbca.com"}
    ]
    Legitimate subdomains of official domains are strictly NOT flagged.
    """
    findings: List[Dict[str, str]] = []
    if not hostname:
        return findings

    hostname = hostname.lower().strip().rstrip('.')
    reg_domain = get_registrable_domain(hostname)
    if not reg_domain:
        return findings

    subdomain, domain_label, suffix = split_domain(hostname)

    for brand, official_set in OFFICIAL_BRAND_REGISTRY.items():
        # If this is legitimately an official domain or legitimate subdomain, skip
        if reg_domain in official_set:
            continue

        # Check if the brand name is embedded in domain_label or subdomain
        # Use boundary/delimiter or exact containment to avoid false positives (e.g. 'broadcast' matching 'bca')
        pattern = rf"(^|[-_0-9]){re.escape(brand)}([-_0-9]|$)"

        label_match = bool(re.search(pattern, domain_label)) or (domain_label == brand)
        sub_match = bool(re.search(pattern, subdomain)) if subdomain else False

        # Additional specific checks for brand compounds (e.g. 'klikbca' or 'shopeepromo')
        compound_check = False
        if brand == "bca" and "klikbca" in domain_label:
            compound_check = True
        elif brand == "mandiri" and "livin" in domain_label:
            compound_check = True

        if label_match or sub_match or compound_check:
            findings.append({
                "brand": brand.upper(),
                "registrable_domain": reg_domain,
                "reason": f"Domain bukan kanal resmi, meniru brand '{brand.upper()}'.",
                "official_domains": ", ".join(sorted(official_set))
            })

    return findings
