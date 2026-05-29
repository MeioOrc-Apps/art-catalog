import pytest

from src.common.url_validator import validate_external_url


def test_validate_external_url():
    assert validate_external_url("http://example.com/image.jpg") == "http://example.com/image.jpg"
    assert validate_external_url("https://example.com/image.png") == "https://example.com/image.png"
    
    with pytest.raises(ValueError):
        validate_external_url("ftp://example.com/image.jpg")
        
    with pytest.raises(ValueError):
        validate_external_url("http://localhost/image.txt")
        
    with pytest.raises(ValueError):
        validate_external_url("not a url")
