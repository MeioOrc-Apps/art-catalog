import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}
BLOCKED_HOSTNAMES = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "ip6-localhost"}


def validate_external_url(url: str) -> str:
    """Reject URLs that point to private/internal networks (SSRF protection)."""
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
        raise ValueError("Private hostname not allowed")

    try:
        resolved_ip = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(resolved_ip)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError(f"IP {resolved_ip} resolves to private/reserved range")
    except socket.gaierror:
        raise ValueError(f"Cannot resolve hostname: {hostname}")

    return url
