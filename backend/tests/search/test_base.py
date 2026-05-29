import pytest


class TestImageResult:
    @pytest.mark.parametrize(
        "field",
        ["image_url", "title", "page_url", "width", "height"],
    )
    def test_fields_exist(self, field):
        from src.search.base import ImageResult

        r = ImageResult(
            image_url="http://x.com/1.jpg",
            title="Test",
            page_url="http://x.com",
            width=800,
            height=600,
        )
        assert hasattr(r, field)

    def test_is_frozen(self):
        from src.search.base import ImageResult

        r = ImageResult(
            image_url="http://x.com/1.jpg",
            title=None,
            page_url=None,
            width=None,
            height=None,
        )
        with pytest.raises(Exception):
            r.image_url = "changed"  # type: ignore[misc]
