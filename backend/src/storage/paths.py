import hashlib


def relative_path(artist_slug: str, url: str, variant: str) -> str:
    url_hash = hashlib.sha256(url.encode()).hexdigest()
    return f"{artist_slug}/{url_hash[:2]}/{url_hash}_{variant}.jpg"
