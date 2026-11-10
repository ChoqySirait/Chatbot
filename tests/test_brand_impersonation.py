"""
Tests for Brand Impersonation, Typosquatting Detection, and Public Suffix List (PSL).
Runs 100% offline with zero external network dependency.
"""

from app.core.public_suffix import (
    get_public_suffix,
    split_domain,
    get_registrable_domain,
    is_official_brand_domain,
    detect_brand_impersonation
)


def test_public_suffix_extraction():
    assert get_public_suffix("bca.co.id") == "co.id"
    assert get_public_suffix("promo.tokopedia.com") == "com"
    assert get_public_suffix("bbc.co.uk") == "co.uk"
    assert get_public_suffix("service.gov.au") == "gov.au"
    assert get_public_suffix("simple.id") == "id"


def test_domain_splitting():
    sub, label, suffix = split_domain("promo.diskon.bca.co.id")
    assert sub == "promo.diskon"
    assert label == "bca"
    assert suffix == "co.id"

    sub2, label2, suffix2 = split_domain("tokopedia.com")
    assert sub2 == ""
    assert label2 == "tokopedia"
    assert suffix2 == "com"


def test_registrable_domain():
    assert get_registrable_domain("m.klikbca.com") == "klikbca.com"
    assert get_registrable_domain("seller.tokopedia.com") == "tokopedia.com"
    assert get_registrable_domain("shopee.co.id") == "shopee.co.id"
    assert get_registrable_domain("fake-bca.online") == "fake-bca.online"


def test_official_brand_domains():
    # Official domains and subdomains
    assert is_official_brand_domain("bca.co.id", "bca") is True
    assert is_official_brand_domain("m.bca.co.id", "bca") is True
    assert is_official_brand_domain("klikbca.com", "bca") is True
    assert is_official_brand_domain("vpn.klikbca.com", "bca") is True
    assert is_official_brand_domain("tokopedia.com", "tokopedia") is True
    assert is_official_brand_domain("promo.tokopedia.com", "tokopedia") is True
    assert is_official_brand_domain("shopee.co.id", "shopee") is True
    assert is_official_brand_domain("wa.me", "whatsapp") is True


def test_brand_impersonation_detection():
    # Fake / impersonation domains
    fake_bca = detect_brand_impersonation("bca-promo-diskon.online")
    assert len(fake_bca) > 0
    assert fake_bca[0]["brand"] == "BCA"

    fake_klikbca = detect_brand_impersonation("klikbca-update.xyz")
    assert len(fake_klikbca) > 0
    assert fake_klikbca[0]["brand"] == "BCA"

    fake_tokped = detect_brand_impersonation("tokopedia-hadiah.club")
    assert len(fake_tokped) > 0
    assert fake_tokped[0]["brand"] == "TOKOPEDIA"

    fake_shopee = detect_brand_impersonation("shopee-promo90.site")
    assert len(fake_shopee) > 0
    assert fake_shopee[0]["brand"] == "SHOPEE"


def test_benign_non_impersonation_domains():
    # Legitimate domains must NOT be flagged as impersonation
    assert len(detect_brand_impersonation("bca.co.id")) == 0
    assert len(detect_brand_impersonation("m.bca.co.id")) == 0
    assert len(detect_brand_impersonation("tokopedia.com")) == 0
    assert len(detect_brand_impersonation("shopee.co.id")) == 0

    # Words containing brand letters as a substring of a different word (e.g. 'broadcast' containing 'bca')
    assert len(detect_brand_impersonation("broadcast.com")) == 0
    assert len(detect_brand_impersonation("danantara.id")) == 0
