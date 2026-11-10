"""
Security Core Module: SSRF Protection, Safe DNS Resolution, and Sanitization.
Implements defense-in-depth against SSRF, DNS Rebinding, and Injection attacks.
"""

import re
import socket
import ipaddress
from urllib.parse import urlparse
from typing import Tuple, List, Dict, Any, Optional, Set

INJECTION_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"bypass (all )?security protocols",
    r"system prompt override",
    r"you are now in developer mode",
    r"dan mode",
]

# Explicit non-global and restricted IPv4 networks
RESTRICTED_IPV4_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # Current network (only valid as source)
    ipaddress.ip_network("10.0.0.0/8"),          # RFC 1918 Private
    ipaddress.ip_network("100.64.0.0/10"),       # RFC 6598 Carrier-Grade NAT
    ipaddress.ip_network("127.0.0.0/8"),         # RFC 1122 Loopback
    ipaddress.ip_network("169.254.0.0/16"),      # RFC 3927 Link-Local / Cloud Metadata
    ipaddress.ip_network("172.16.0.0/12"),       # RFC 1918 Private
    ipaddress.ip_network("192.0.0.0/24"),        # RFC 6890 IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),        # RFC 5737 Documentation (TEST-NET-1)
    ipaddress.ip_network("192.168.0.0/16"),      # RFC 1918 Private
    ipaddress.ip_network("198.18.0.0/15"),       # RFC 2544 Benchmarking
    ipaddress.ip_network("198.51.100.0/24"),     # RFC 5737 Documentation (TEST-NET-2)
    ipaddress.ip_network("203.0.113.0/24"),      # RFC 5737 Documentation (TEST-NET-3)
    ipaddress.ip_network("224.0.0.0/4"),         # RFC 5771 Multicast
    ipaddress.ip_network("240.0.0.0/4"),         # RFC 1112 Reserved Class E
    ipaddress.ip_network("255.255.255.255/32"),  # RFC 919 Limited Broadcast
]

# Explicit non-global and restricted IPv6 networks
RESTRICTED_IPV6_NETWORKS = [
    ipaddress.ip_network("::/128"),              # Unspecified
    ipaddress.ip_network("::1/128"),            # Loopback
    ipaddress.ip_network("100::/64"),           # Discard prefix
    ipaddress.ip_network("2001:db8::/32"),      # Documentation
    ipaddress.ip_network("fc00::/7"),           # Unique Local Address (ULA)
    ipaddress.ip_network("fe80::/10"),          # Link-Local Unicast
    ipaddress.ip_network("ff00::/8"),           # Multicast
    ipaddress.ip_network("fd00:ec2::254/128"),  # AWS IMDSv2 IPv6 Metadata
]


def is_ip_global_and_safe(ip: ipaddress._BaseAddress) -> Tuple[bool, str]:
    """
    Verifies that an IP address is strictly a routable public global address.
    Rejects private, loopback, link-local, carrier-grade NAT, multicast, reserved,
    cloud metadata, and IPv4-mapped/6to4 tunneled private addresses.
    """
    if str(ip) == "169.254.169.254":
        return False, "Cloud Instance Metadata Service (IMDS)"
    if ip.is_link_local:
        return False, "Link-local / metadata address"
    if ip.is_loopback:
        return False, "Loopback address (localhost)"
    if ip.is_private:
        return False, "Private RFC 1918/ULA address"
    if ip.is_multicast:
        return False, "Multicast address"
    if ip.is_unspecified:
        return False, "Unspecified address (0.0.0.0 / ::)"
    if ip.is_reserved:
        return False, "Reserved address"

    if isinstance(ip, ipaddress.IPv4Address):
        # Cloud metadata check
        if str(ip) == "169.254.169.254":
            return False, "Cloud Instance Metadata Service (IMDS)"

        for net in RESTRICTED_IPV4_NETWORKS:
            if ip in net:
                return False, f"Restricted IPv4 network ({net})"

    elif isinstance(ip, ipaddress.IPv6Address):
        # Check IPv4-mapped IPv6 (::ffff:192.168.1.1)
        if ip.ipv4_mapped:
            mapped_ok, mapped_reason = is_ip_global_and_safe(ip.ipv4_mapped)
            if not mapped_ok:
                return False, f"IPv4-mapped non-global: {mapped_reason}"

        # Check 6to4 2002::/16 embedded IPv4
        if ip in ipaddress.ip_network("2002::/16"):
            embedded_ipv4 = ipaddress.IPv4Address(ip.packed[2:6])
            emb_ok, emb_reason = is_ip_global_and_safe(embedded_ipv4)
            if not emb_ok:
                return False, f"6to4 embedded non-global: {emb_reason}"

        for net in RESTRICTED_IPV6_NETWORKS:
            if ip in net:
                return False, f"Restricted IPv6 network ({net})"

    return True, "Global routable public IP"


def resolve_and_validate_hostname(hostname: str) -> Tuple[bool, List[str], str]:
    """
    Resolves all A and AAAA DNS records for a hostname and enforces that every
    single resolved IP address is globally routable.
    If a domain resolves to mixed addresses (some public, some private), it is rejected.
    """
    clean_host = hostname.strip().strip("[]").lower()
    if not clean_host:
        return False, [], "Empty hostname"

    # Reject obvious local aliases
    if clean_host in {"localhost", "localtest.me"} or clean_host.endswith(".localhost") or clean_host.endswith(".local"):
        return False, [], "Localhost / internal domain alias rejected"

    # Check if hostname is already a literal IP address
    try:
        ip = ipaddress.ip_address(clean_host)
        is_safe, reason = is_ip_global_and_safe(ip)
        if not is_safe:
            return False, [], f"IP literal rejected: {reason}"
        return True, [str(ip)], "Valid literal public IP"
    except ValueError:
        pass

    # Resolve all DNS A and AAAA records
    try:
        addrinfo = socket.getaddrinfo(clean_host, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        return False, [], f"DNS resolution failed: {e.strerror}"
    except Exception as e:
        return False, [], f"DNS resolution error: {str(e)}"

    if not addrinfo:
        return False, [], "No DNS records found for host"

    resolved_ips: List[str] = []
    seen: Set[str] = set()

    for item in addrinfo:
        sockaddr = item[4]
        ip_str = sockaddr[0]
        if ip_str in seen:
            continue
        seen.add(ip_str)

        try:
            ip_obj = ipaddress.ip_address(ip_str)
            is_safe, reason = is_ip_global_and_safe(ip_obj)
            if not is_safe:
                # Any non-global IP causes total rejection to prevent DNS rebinding attacks
                return False, [], f"Host resolved to non-global address {ip_str} ({reason})"
            resolved_ips.append(ip_str)
        except ValueError:
            return False, [], f"Invalid IP returned by DNS: {ip_str}"

    if not resolved_ips:
        return False, [], "No valid IP addresses resolved"

    return True, resolved_ips, "All resolved DNS records are public and safe"


def validate_url_for_ssrf(url: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Validates a URL against SSRF vulnerabilities:
    - Validates scheme (http, https only)
    - Validates hostname syntax
    - Resolves all DNS records and checks all addresses
    - Returns metadata including resolved safe IPs and canonical URL
    """
    if not url or not isinstance(url, str):
        return False, "URL tidak boleh kosong.", None

    url_clean = url.strip()
    if "://" in url_clean:
        try:
            parsed = urlparse(url_clean)
        except Exception as e:
            return False, f"Format URL tidak valid: {str(e)}", None
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            return False, f"Skema URL '{scheme}' tidak diizinkan. Hanya http dan https didukung.", None
    elif any(url_clean.lower().startswith(s) for s in ("http:", "https:", "ftp:", "file:", "gopher:", "javascript:", "data:")):
        return False, "Skema URL tidak diizinkan atau format URL salah.", None
    else:
        url_clean = 'https://' + url_clean
        try:
            parsed = urlparse(url_clean)
        except Exception as e:
            return False, f"Format URL tidak valid: {str(e)}", None

    if parsed.username or parsed.password:
        return False, "URL dengan kredensial autentikasi (user:pass@) tidak diizinkan.", None

    hostname = parsed.hostname
    if not hostname:
        return False, "Hostname tidak ditemukan dalam URL.", None

    port = parsed.port or (443 if scheme == "https" else 80)
    if port not in (80, 443, 8080, 8443):
        return False, f"Port {port} tidak diizinkan untuk inspeksi publik.", None

    is_safe, resolved_ips, reason = resolve_and_validate_hostname(hostname)
    if not is_safe:
        return False, reason, None

    metadata = {
        "scheme": scheme,
        "hostname": hostname.lower(),
        "port": port,
        "path": parsed.path or "/",
        "query": parsed.query,
        "canonical_url": f"{scheme}://{hostname}:{port}{parsed.path or '/'}" + (f"?{parsed.query}" if parsed.query else ""),
        "validated_ips": resolved_ips,
        "primary_ip": resolved_ips[0]
    }

    return True, "URL aman dan siap diinspeksi.", metadata


def is_safe_public_url(url: str) -> bool:
    """
    Backward-compatible boolean wrapper for SSRF verification.
    Uses the hardened validate_url_for_ssrf function.
    """
    is_safe, _, _ = validate_url_for_ssrf(url)
    return is_safe


def sanitize_user_input(text: str) -> str:
    """Sanitasi input pengguna dasar."""
    cleaned = text.strip()
    cleaned = re.sub(r'<script.*?>.*?</script>', '', cleaned, flags=re.IGNORECASE | re.DOTALL)
    return cleaned


def check_prompt_injection(text: str) -> bool:
    """Deteksi pola prompt injection dasar."""
    lower_text = text.lower()
    return any(re.search(pat, lower_text) for pat in INJECTION_PATTERNS)


def defang_url(url: str) -> str:
    """Menetralkan URL berbahaya agar aman ditampilkan di UI (mis: hxxps[://]domain[.]com)"""
    defanged = re.sub(r'^https://', 'hxxps://', url, flags=re.IGNORECASE)
    defanged = re.sub(r'^http://', 'hxxp://', defanged, flags=re.IGNORECASE)
    defanged = defanged.replace('.', '[.]')
    defanged = defanged.replace('://', '[://]')
    return defanged
