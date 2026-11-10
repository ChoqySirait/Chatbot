"""
Unit & Security Tests for SSRF Protection, Safe DNS Resolution, and Hardened Scraper.
All tests run 100% offline using deterministic mocks for DNS and HTTP.
Zero requests are sent to real external or internal targets.
"""

import socket
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.core.security import (
    is_ip_global_and_safe,
    resolve_and_validate_hostname,
    validate_url_for_ssrf,
    is_safe_public_url
)
from app.core.heuristics import scrape_web_sample
import ipaddress


def test_public_ipv4_allowed():
    ip = ipaddress.ip_address("8.8.8.8")
    is_safe, reason = is_ip_global_and_safe(ip)
    assert is_safe is True
    assert "Global" in reason


def test_private_ipv4_rfc1918_rejected():
    for addr in ["10.0.0.1", "172.16.0.5", "192.168.1.1"]:
        ip = ipaddress.ip_address(addr)
        is_safe, reason = is_ip_global_and_safe(ip)
        assert is_safe is False
        assert "Private" in reason or "Restricted" in reason


def test_loopback_rejected():
    for addr in ["127.0.0.1", "127.0.1.1", "::1"]:
        ip = ipaddress.ip_address(addr)
        is_safe, reason = is_ip_global_and_safe(ip)
        assert is_safe is False
        assert "Loopback" in reason


def test_cloud_metadata_rejected():
    # AWS / GCP / Azure IMDS IPv4
    ip_imds = ipaddress.ip_address("169.254.169.254")
    is_safe, reason = is_ip_global_and_safe(ip_imds)
    assert is_safe is False
    assert "Metadata" in reason or "Link-local" in reason

    # AWS IMDSv2 IPv6
    ip_imds_v6 = ipaddress.ip_address("fd00:ec2::254")
    is_safe_v6, reason_v6 = is_ip_global_and_safe(ip_imds_v6)
    assert is_safe_v6 is False


def test_cgnat_and_documentation_rejected():
    # Carrier-Grade NAT
    ip_cgnat = ipaddress.ip_address("100.64.0.1")
    is_safe, _ = is_ip_global_and_safe(ip_cgnat)
    assert is_safe is False

    # Documentation TEST-NET-1
    ip_doc = ipaddress.ip_address("192.0.2.1")
    is_safe_doc, _ = is_ip_global_and_safe(ip_doc)
    assert is_safe_doc is False


def test_ipv4_mapped_ipv6_private_rejected():
    # ::ffff:192.168.1.1 (IPv4-mapped private address)
    ip_mapped = ipaddress.ip_address("::ffff:192.168.1.1")
    is_safe, reason = is_ip_global_and_safe(ip_mapped)
    assert is_safe is False
    assert "non-global" in reason.lower() or "private" in reason.lower() or "restricted" in reason.lower()


def test_dns_resolution_pure_public():
    # Mock socket.getaddrinfo returning only public IPs
    mock_addrinfo = [
        (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 80)),
        (socket.AF_INET6, socket.SOCK_STREAM, 6, '', ('2606:2800:220:1:248:1893:25c8:1946', 80))
    ]
    with patch("socket.getaddrinfo", return_value=mock_addrinfo):
        is_safe, ips, reason = resolve_and_validate_hostname("example.com")
        assert is_safe is True
        assert len(ips) == 2
        assert "93.184.216.34" in ips


def test_dns_resolution_mixed_addresses_rejected():
    # Domain returning 1 public IP and 1 internal IP (e.g. DNS rebinding tactic)
    mock_addrinfo = [
        (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 80)),
        (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 80))
    ]
    with patch("socket.getaddrinfo", return_value=mock_addrinfo):
        is_safe, ips, reason = resolve_and_validate_hostname("evil-rebind.com")
        assert is_safe is False
        assert len(ips) == 0
        assert "non-global address 127.0.0.1" in reason


def test_disallowed_schemes_rejected():
    for bad_url in ["ftp://example.com", "file:///etc/passwd", "gopher://evil.com", "javascript:alert(1)"]:
        is_safe, reason, meta = validate_url_for_ssrf(bad_url)
        assert is_safe is False
        assert "Skema URL" in reason or "Format URL" in reason


def test_userinfo_in_url_rejected():
    is_safe, reason, _ = validate_url_for_ssrf("http://admin:secret@example.com")
    assert is_safe is False
    assert "kredensial autentikasi" in reason


def test_disallowed_ports_rejected():
    mock_addrinfo = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 22))]
    with patch("socket.getaddrinfo", return_value=mock_addrinfo):
        # Port 22 SSH should be rejected
        is_safe, reason, _ = validate_url_for_ssrf("http://example.com:22/test")
        assert is_safe is False
        assert "Port 22 tidak diizinkan" in reason


@pytest.mark.asyncio
async def test_scraper_redirect_to_private_ip_blocked():
    # Step 1: Initial public page returns 302 to http://192.168.1.1/admin
    with patch("app.core.security.resolve_and_validate_hostname") as mock_dns:
        # First hop example.com resolves to public IP
        # Second hop 192.168.1.1 will be rejected by SSRF guard
        mock_dns.side_effect = [
            (True, ["93.184.216.34"], "Public"),
            (False, [], "Restricted private network")
        ]

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 302
            mock_resp.headers = {"Location": "http://192.168.1.1/admin"}
            mock_get.return_value = mock_resp

            result = await scrape_web_sample("https://example.com")
            assert result["accessible"] is False
            assert "Ditolak: Pelanggaran Keamanan Jaringan / SSRF" in result["title"]
            assert result["hops"] == 1


@pytest.mark.asyncio
async def test_scraper_exceeded_redirect_hops_blocked():
    # Continual redirect loop
    with patch("app.core.security.resolve_and_validate_hostname", return_value=(True, ["93.184.216.34"], "Public")):
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 302
            mock_resp.headers = {"Location": "https://example.com/redirect"}
            mock_get.return_value = mock_resp

            result = await scrape_web_sample("https://example.com")
            assert result["accessible"] is False
            assert "Melebihi Batas Maksimum" in result["title"]
            assert result["hops"] > 5
