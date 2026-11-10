"""
Network Intelligence Core Module.
Provides hardened SSL certificate inspection, ICANN RDAP domain registration analysis,
and cryptographic evidence manifest generation with full 64-character SHA-256 seals.
"""

import socket
import ssl
import json
import hashlib
import datetime
import asyncio
from urllib.parse import urlparse
import httpx
from typing import Dict, Any, Optional

from app.core.security import resolve_and_validate_hostname


def get_domain_from_url(url: str) -> str:
    """Ekstrak nama domain murni dari URL."""
    if not url:
        return ""
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    domain = parsed.hostname or url.split('/')[0]
    return domain.lower().strip()


def generate_evidence_hash(data: str) -> str:
    """
    Menghasilkan segel integritas SHA-256 64-karakter penuh.
    Memperbaiki kerapuhan pemotongan 16-karakter sebelumnya.
    """
    if data is None:
        data = ""
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def create_evidence_manifest(
    source: str,
    content: bytes,
    mime_type: str = "text/plain",
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Menyusun manifest bukti forensik digital deterministik.
    Mencakup metadata identitas artefak, MIME, ukuran, timestamp UTC,
    raw SHA-256 (64 hex chars), dan segel kanonikal.
    """
    raw_hash = hashlib.sha256(content).hexdigest()
    now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    manifest_core = {
        "source": source,
        "mime_type": mime_type,
        "size_bytes": len(content),
        "timestamp_utc": now_utc,
        "raw_sha256": raw_hash,
        "metadata": metadata or {}
    }
    
    # Serialisasi kanonikal deterministik (sorted keys, compact separators)
    canonical_json = json.dumps(manifest_core, sort_keys=True, separators=(',', ':'))
    canonical_hash = hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()
    
    manifest = {
        **manifest_core,
        "canonical_manifest_sha256": canonical_hash,
        "disclaimer": (
            "Segel kriptografis SHA-256 menjamin integritas data (tamper-evident), "
            "namun tidak secara mandiri menjamin keabsahan hukum atau kebenaran kejadian tanpa validasi forensik berwenang."
        )
    }
    return manifest


def verify_evidence_manifest(manifest: Dict[str, Any], raw_bytes: bytes) -> bool:
    """
    Memverifikasi integritas bukti digital:
    1. Memastikan raw_bytes menghasilkan SHA-256 yang cocok dengan manifest.
    2. Memastikan canonical_manifest_sha256 valid terhadap metadata manifest.
    """
    if not manifest or "raw_sha256" not in manifest or "canonical_manifest_sha256" not in manifest:
        return False
    
    # Verifikasi hash konten mentah
    actual_raw_hash = hashlib.sha256(raw_bytes).hexdigest()
    if actual_raw_hash != manifest["raw_sha256"]:
        return False
        
    # Verifikasi hash kanonikal manifest
    manifest_core = {
        "source": manifest.get("source", ""),
        "mime_type": manifest.get("mime_type", ""),
        "size_bytes": manifest.get("size_bytes", 0),
        "timestamp_utc": manifest.get("timestamp_utc", ""),
        "raw_sha256": manifest.get("raw_sha256", ""),
        "metadata": manifest.get("metadata", {})
    }
    canonical_json = json.dumps(manifest_core, sort_keys=True, separators=(',', ':'))
    expected_canonical_hash = hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()
    
    return expected_canonical_hash == manifest["canonical_manifest_sha256"]


def _check_ssl_sync(domain: str) -> Dict[str, Any]:
    """
    Pemeriksaan sertifikat SSL/TLS tersinkronisasi dan diperkeras.
    Menerapkan validasi DNS dan koneksi soket langsung ke IP publik yang tervalidasi
    dengan verifikasi SNI/sertifikat terhadap hostname asli.
    """
    clean_domain = domain.strip().lower()
    if not clean_domain:
        return {
            "valid": False,
            "issuer": "Domain Tidak Valid",
            "days_remaining": 0,
            "is_free_cert": False
        }

    # 1. Validasi DNS pre-check untuk proteksi SSRF
    is_safe, resolved_ips, reason = resolve_and_validate_hostname(clean_domain)
    if not is_safe or not resolved_ips:
        return {
            "valid": False,
            "issuer": f"Ditolak: {reason}",
            "days_remaining": 0,
            "is_free_cert": False
        }

    pinned_ip = resolved_ips[0]

    try:
        # Gunakan konteks default dengan verifikasi CA sistem aktif
        context = ssl.create_default_context()
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED

        # Koneksi ke pinned_ip, tetapi wrap_socket memverifikasi terhadap clean_domain
        with socket.create_connection((pinned_ip, 443), timeout=2.0) as sock:
            with context.wrap_socket(sock, server_hostname=clean_domain) as ssock:
                cert = ssock.getpeercert()
                issuer = dict(x[0] for x in cert.get('issuer', []))
                issuer_org = issuer.get('organizationName', 'Penerbit SSL Umum')
                
                not_after = cert.get('notAfter')
                expiry_date = datetime.datetime.strptime(not_after, '%b %d %H:%M:%S %Y %Z') if not_after else None
                now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                days_left = (expiry_date - now_utc).days if expiry_date else 0
                
                return {
                    "valid": True,
                    "issuer": issuer_org,
                    "days_remaining": max(days_left, 0),
                    "is_free_cert": "Let's Encrypt" in issuer_org or "Cloudflare" in issuer_org
                }
    except ssl.SSLCertVerificationError:
        return {
            "valid": False,
            "issuer": "Sertifikat TLS Tidak Terverifikasi / Untrusted",
            "days_remaining": 0,
            "is_free_cert": False
        }
    except Exception:
        return {
            "valid": False,
            "issuer": "Tidak Terpasang / Sertifikat Bermasalah",
            "days_remaining": 0,
            "is_free_cert": False
        }


async def inspect_ssl_certificate(domain: str) -> Dict[str, Any]:
    """Fungsi asinkron non-blocking untuk inspeksi SSL."""
    return await asyncio.to_thread(_check_ssl_sync, domain)


async def inspect_domain_registration(domain: str) -> Dict[str, Any]:
    """
    Inspeksi pendaftaran domain via ICANN RDAP secara aman.
    Memastikan tidak mengirim query jika domain adalah IP numerik atau memiliki karakter terlarang.
    """
    clean_domain = domain.strip().lower()
    if not clean_domain or any(c in clean_domain for c in "/?#@:"):
        return {"age_days": None, "creation_date": "Domain Tidak Valid", "registrar": "None"}

    if any(char.isdigit() for char in clean_domain.split('.')):
        parts = clean_domain.split('.')
        if len(parts) == 4 and all(p.isdigit() for p in parts):
            return {"age_days": None, "creation_date": "Alamat IP Numerik", "registrar": "None"}

    rdap_url = f"https://rdap.org/domain/{clean_domain}"
    try:
        # Client HTTPX terisolasi dengan timeout ketat
        async with httpx.AsyncClient(timeout=2.0, follow_redirects=True, verify=True, trust_env=False) as client:
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
                    now_utc = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                    age_days = (now_utc - reg_date).days
                    
                    registrar_name = "Registrar Umum"
                    entities = data.get("entities", [])
                    if entities and isinstance(entities, list):
                        for ent in entities:
                            vcard = ent.get("vcardArray", [])
                            if len(vcard) > 1 and isinstance(vcard[1], list):
                                for prop in vcard[1]:
                                    if len(prop) > 3 and prop[0] == "fn":
                                        registrar_name = prop[3]
                                        break
                    
                    return {
                        "age_days": age_days,
                        "creation_date": reg_date.strftime("%d %b %Y"),
                        "registrar": registrar_name
                    }
    except Exception:
        pass

    return {"age_days": None, "creation_date": "Data RDAP Terbatas", "registrar": "Registrar Umum"}
