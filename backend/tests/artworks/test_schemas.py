import pytest
from pydantic import ValidationError


class TestSearchPayload:
    def test_valid_payload(self):
        from src.artworks.schemas import SearchPayload

        p = SearchPayload(artist="Egon Schiele")
        assert p.artist == "Egon Schiele"
        assert p.limit == 30  # default
        assert p.refresh is False

    def test_artist_non_empty(self):
        from src.artworks.schemas import SearchPayload

        with pytest.raises(ValidationError):
            SearchPayload(artist="")

    def test_limit_range_1_to_200(self):
        from src.artworks.schemas import SearchPayload

        assert SearchPayload(artist="X", limit=1).limit == 1
        assert SearchPayload(artist="X", limit=100).limit == 100
        assert SearchPayload(artist="X", limit=200).limit == 200

        with pytest.raises(ValidationError):
            SearchPayload(artist="X", limit=0)
        with pytest.raises(ValidationError):
            SearchPayload(artist="X", limit=201)

    def test_refresh_default_false(self):
        from src.artworks.schemas import SearchPayload

        p = SearchPayload(artist="X")
        assert p.refresh is False


class TestArtworkOut:
    def test_accepts_dominant_colors_rgb(self):
        from src.artworks.schemas import ArtworkOut

        a = ArtworkOut(
            id="00000000-0000-0000-0000-000000000001",
            source_image_url="http://x.com/img.jpg",
            dominant_colors=[[255, 0, 0], [0, 255, 0]],
            created_at="2024-01-01T00:00:00Z",
        )
        assert a.dominant_colors == [[255, 0, 0], [0, 255, 0]]

    def test_dominant_colors_can_be_none(self):
        from src.artworks.schemas import ArtworkOut

        a = ArtworkOut(
            id="00000000-0000-0000-0000-000000000001",
            source_image_url="http://x.com/img.jpg",
            dominant_colors=None,
            created_at="2024-01-01T00:00:00Z",
        )
        assert a.dominant_colors is None
