import pytest

from src.common.url_validator import make_safe_async_client, validate_external_url


def test_validate_external_url_ok():
    assert validate_external_url("http://example.com/image.jpg") == "http://example.com/image.jpg"
    assert validate_external_url("https://example.com/image.png") == "https://example.com/image.png"


def test_validate_external_url_bad_scheme():
    with pytest.raises(ValueError, match="Scheme"):
        validate_external_url("ftp://example.com/image.jpg")


def test_validate_external_url_localhost():
    with pytest.raises(ValueError):
        validate_external_url("http://localhost/image.txt")


def test_validate_external_url_invalid():
    with pytest.raises(ValueError):
        validate_external_url("not a url")


def test_validate_external_url_private_ip():
    with pytest.raises(ValueError):
        validate_external_url("http://192.168.1.1/secret")


def test_validate_external_url_loopback():
    with pytest.raises(ValueError):
        validate_external_url("http://127.0.0.1/admin")


def test_make_safe_async_client_returns_client():
    import httpx
    client = make_safe_async_client(timeout=10)
    assert isinstance(client, httpx.AsyncClient)


@pytest.mark.asyncio
async def test_safe_transport_blocks_private_ip():
    """SafeAsyncTransport must refuse connections to RFC-1918 addresses."""
    import httpx

    from src.common.url_validator import make_safe_async_client

    async with make_safe_async_client(timeout=5) as client:
        with pytest.raises((httpx.ConnectError, httpx.UnsupportedProtocol)):
            await client.get("http://192.168.1.1/test")


@pytest.mark.asyncio
async def test_safe_transport_blocks_loopback():
    import httpx

    async with make_safe_async_client(timeout=5) as client:
        with pytest.raises((httpx.ConnectError, httpx.UnsupportedProtocol)):
            await client.get("http://127.0.0.1/test")
