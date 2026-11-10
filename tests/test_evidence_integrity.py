"""
Tests for Evidence Integrity and Cryptographic Manifest Verification (SEC-04).
Runs 100% offline.
"""

from app.core.network_intel import (
    generate_evidence_hash,
    create_evidence_manifest,
    verify_evidence_manifest
)


def test_sha256_full_64_characters():
    payload = "Tautan bukti transfer https://bca-palsu.online nominal Rp 5.000.000"
    hash_val = generate_evidence_hash(payload)
    assert len(hash_val) == 64
    assert all(c in "0123456789abcdef" for c in hash_val.lower())


def test_manifest_structure_and_canonical_hash():
    sample_bytes = b"<html><title>Phishing Site</title><body>Form login bank</body></html>"
    source = "https://fake-login-bank.xyz/login.html"
    
    manifest = create_evidence_manifest(
        source=source,
        content=sample_bytes,
        mime_type="text/html",
        metadata={"tested_by": "SOC Analyst"}
    )
    
    assert manifest["source"] == source
    assert manifest["mime_type"] == "text/html"
    assert manifest["size_bytes"] == len(sample_bytes)
    assert len(manifest["raw_sha256"]) == 64
    assert len(manifest["canonical_manifest_sha256"]) == 64
    assert "disclaimer" in manifest
    assert "tidak secara mandiri menjamin keabsahan hukum" in manifest["disclaimer"]


def test_manifest_verification_success():
    sample_bytes = b"Raw digital forensics screenshot bytes payload"
    manifest = create_evidence_manifest("incident_image.png", sample_bytes, "image/png")
    
    # Valid verification
    assert verify_evidence_manifest(manifest, sample_bytes) is True


def test_one_byte_alteration_detected():
    sample_bytes = b"Sensitive transaction data payload 1000000"
    manifest = create_evidence_manifest("transaction.txt", sample_bytes, "text/plain")
    
    # Tamper with 1 byte (change last digit from 0 to 1)
    tampered_bytes = b"Sensitive transaction data payload 1000001"
    
    # Must fail verification
    assert verify_evidence_manifest(manifest, tampered_bytes) is False


def test_manifest_metadata_tampering_detected():
    sample_bytes = b"Incident evidence data"
    manifest = create_evidence_manifest("evidence.bin", sample_bytes, "application/octet-stream")
    
    # Tamper with timestamp or source inside manifest without updating canonical hash
    tampered_manifest = dict(manifest)
    tampered_manifest["source"] = "https://altered-source.com"
    
    # Must fail verification
    assert verify_evidence_manifest(tampered_manifest, sample_bytes) is False
