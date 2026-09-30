import socket
import ssl
import hashlib
import datetime
import asyncio
from urllib.parse import urlparse
import httpx
from typing import Dict, Any

# Blok kode ini mengekstrak nama domain murni dari tautan URL
def get_domain_from_url(url: str) -> str:
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    domain = parsed.hostname or url.split('/')[0]
    return domain.lower().strip()

# Blok kode ini membuat segel integritas SHA-256 untuk bukti digital
def generate_evidence_hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()[:16]

# Blok kode sinkron socket SSL yang dibungkus threadpool agar non-blocking
def _check_ssl_sync(domain: str) -> Dict[str, Any]:
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=1.8) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                issuer = dict(x[0] for x in cert.get('issuer', []))
                issuer_org = issuer.get('organizationName', 'Penerbit SSL Umum')
                
                not_after = cert.get('notAfter')
                expiry_date = datetime.datetime.strptime(not_after, '%b %d %H:%M:%S %Y %Z') if not_after else None
                days_left = (expiry_date - datetime.datetime.utcnow()).days if expiry_date else 0
                
                return {
                    "valid": True,
                    "issuer": issuer_org,
                    "days_remaining": days_left,
                    "is_free_cert": "Let's Encrypt" in issuer_org or "Cloudflare" in issuer_org
                }
    except Exception:
        return {
            "valid": False,
            "issuer": "Tidak Terpasang / Sertifikat Bermasalah",
            "days_remaining": 0,
            "is_free_cert": False
        }

# Blok kode asinkron inspeksi SSL
async def inspect_ssl_certificate(domain: str) -> Dict[str, Any]:
    return await asyncio.to_thread(_check_ssl_sync, domain)

# Blok kode asinkron inspeksi pendaftaran domain via RDAP ICANN
async def inspect_domain_registration(domain: str) -> Dict[str, Any]:
    if any(char.isdigit() for char in domain.split('.')):
        parts = domain.split('.')
        if len(parts) == 4 and all(p.isdigit() for p in parts):
            return {"age_days": None, "creation_date": "Alamat IP Numerik", "registrar": "None"}

    rdap_url = f"https://rdap.org/domain/{domain}"
    try:
        async with httpx.AsyncClient(timeout=1.8, follow_redirects=True) as client:
            resp = await client.get(rdap_url)
            if resp.status_code == 200:
                data = resp.json()
                events = data.get("events", [])
                reg_date = None
                for ev in events:
                    if ev.get("eventAction") in ["registration", "created"]:
                        reg_date_str = ev.get("eventDate", "")[:10]
                        reg_date = datetime.datetime.strptime(reg_date_str, "%Y-%m-%d")
                        break
                
                if reg_date:
                    age_days = (datetime.datetime.utcnow() - reg_date).days
                    registrar_name = data.get("entities", [{}])[0].get("vcardArray", [None, [[]]])[1][1][3] if data.get("entities") else "Penyedia Domain"
                    return {
                        "age_days": age_days,
                        "creation_date": reg_date.strftime("%d %b %Y"),
                        "registrar": registrar_name
                    }
    except Exception:
        pass

    return {"age_days": None, "creation_date": "Data RDAP Terbatas", "registrar": "Registrar Umum"}