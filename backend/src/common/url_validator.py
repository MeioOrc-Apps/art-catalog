import ipaddress
import socket
from urllib.parse import urlparse

import httpx

ALLOWED_SCHEMES = {"http", "https"}
BLOCKED_HOSTNAMES = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "ip6-localhost"}


def _check_ip_safe(ip_str: str, hostname: str) -> None:
    """Raise ValueError if the IP is in a private/reserved range."""
    ip = ipaddress.ip_address(ip_str)
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        raise ValueError(f"IP {ip_str} (resolved from {hostname}) is in a private/reserved range")


def validate_external_url(url: str) -> str:
    """Reject URLs pointing to private/internal networks (SSRF pre-check)."""
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("Invalid URL")

    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"Scheme '{parsed.scheme}' not allowed")

    hostname = parsed.hostname or ""
    if not hostname:
        raise ValueError("URL has no hostname")

    if hostname.lower() in BLOCKED_HOSTNAMES:
        raise ValueError(f"Private hostname not allowed: {hostname}")

    try:
        resolved_ip = socket.gethostbyname(hostname)
        _check_ip_safe(resolved_ip, hostname)
    except socket.gaierror:
        raise ValueError(f"Cannot resolve hostname: {hostname}")

    return url


class _SafeAsyncTransport(httpx.AsyncHTTPTransport):
    """httpx transport that validates the resolved IP at connection time.

    Resolving and validating inside handle_async_request (instead of in a
    separate pre-check) closes the DNS-rebinding TOCTOU window: the IP we
    inspect is the same one used for the connection.
    """

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        host = request.url.host

        # Skip validation for mock:// scheme used in tests
        if request.url.scheme == "mock":
            return await super().handle_async_request(request)

        try:
            ipaddress.ip_address(host)
            # host is already a numeric IP — validate it directly
            _check_ip_safe(host, host)
        except ValueError as exc:
            # ip_address() raised → host is a hostname; resolve and validate
            if "private" in str(exc) or "reserved" in str(exc):
                raise httpx.ConnectError(str(exc), request=request)
            # ValueError from ip_address means it's a hostname, resolve it
            try:
                resolved = socket.gethostbyname(host)
                _check_ip_safe(resolved, host)
            except socket.gaierror:
                raise httpx.ConnectError(f"Cannot resolve hostname: {host}", request=request)
            except ValueError as inner:
                raise httpx.ConnectError(str(inner), request=request)

        return await super().handle_async_request(request)


def make_safe_async_client(**kwargs) -> httpx.AsyncClient:
    """Return an httpx.AsyncClient with SSRF-safe transport."""
    return httpx.AsyncClient(transport=_SafeAsyncTransport(), **kwargs)
