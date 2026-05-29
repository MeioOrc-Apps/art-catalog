import hashlib
import io

from PIL import Image


class TestRelativePaths:
    def test_path_structure(self):
        from src.storage.paths import relative_path

        url = "http://example.com/image.jpg"
        path = relative_path("egon-schiele", url, "thumb")
        url_hash = hashlib.sha256(url.encode()).hexdigest()
        expected = f"egon-schiele/{url_hash[:2]}/{url_hash}_thumb.jpg"
        assert path == expected

    def test_different_variants(self):
        from src.storage.paths import relative_path

        url = "http://example.com/img.jpg"
        thumb = relative_path("test", url, "thumb")
        large = relative_path("test", url, "large")
        assert "thumb" in thumb
        assert "large" in large
        assert thumb != large


class TestResizeVariants:
    def test_returns_three_variants(self):
        from src.storage.images import resize_variants

        img = Image.new("RGB", (2400, 1800), (100, 150, 200))
        result = resize_variants(img)
        assert set(result.keys()) == {"original", "large", "thumb"}

    def test_large_resized_to_2000px_max_side(self):
        from src.storage.images import resize_variants

        img = Image.new("RGB", (2400, 1800), (100, 150, 200))
        result = resize_variants(img)
        large = Image.open(result["large"])
        max_dim = max(large.size)
        assert max_dim <= 2000

    def test_thumb_resized_to_400px_max_side(self):
        from src.storage.images import resize_variants

        img = Image.new("RGB", (2400, 1800), (100, 150, 200))
        result = resize_variants(img)
        thumb = Image.open(result["thumb"])
        max_dim = max(thumb.size)
        assert max_dim <= 400

    def test_converts_rgba_to_rgb(self):
        from src.storage.images import resize_variants

        img = Image.new("RGBA", (100, 100), (255, 0, 0, 128))
        result = resize_variants(img)
        original = Image.open(result["original"])
        assert original.mode == "RGB"

    def test_saves_as_bytes(self):
        from src.storage.images import resize_variants

        img = Image.new("RGB", (800, 600), (200, 100, 50))
        result = resize_variants(img)
        for buf in result.values():
            assert isinstance(buf, io.BytesIO)
            assert len(buf.getvalue()) > 0


class TestSynthesizeMockBytes:
    def test_returns_valid_jpeg_bytes(self):
        from src.storage.images import _synthesize_mock_bytes

        data = _synthesize_mock_bytes("mock://abc/0.jpg")
        img = Image.open(io.BytesIO(data))
        assert img.format == "JPEG"

    def test_is_deterministic(self):
        from src.storage.images import _synthesize_mock_bytes

        d1 = _synthesize_mock_bytes("mock://abc/0.jpg")
        d2 = _synthesize_mock_bytes("mock://abc/0.jpg")
        assert d1 == d2

    def test_minimum_width(self):
        from src.storage.images import _synthesize_mock_bytes

        data = _synthesize_mock_bytes("mock://x/0.jpg")
        img = Image.open(io.BytesIO(data))
        assert img.width >= 1200
