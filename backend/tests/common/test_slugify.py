import pytest
from src.common.slugify import make_slug

def test_make_slug():
    assert make_slug("Vincent van Gogh") == "vincent-van-gogh"
    assert make_slug("  test  ") == "test"
    assert make_slug("A!@#B") == "a-b"
    assert make_slug("Café") == "cafe"
