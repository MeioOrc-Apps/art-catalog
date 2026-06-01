"""Tests for BraveProvider, focusing on the pagination logic."""
import pytest
import respx
import httpx


def _make_results(prefix: str, count: int, query: str = "monet art") -> list[dict]:
    """Build fake Brave API result objects that pass the keyword filter."""
    return [
        {
            "title": f"{query} work {i}",
            "url": f"https://page.example/{prefix}/{i}",
            "properties": {
                "url": f"https://img.example/{prefix}/{i}.jpg",
                "width": 1200,
                "height": 900,
            },
        }
        for i in range(count)
    ]


@pytest.mark.asyncio
class TestBraveProviderPagination:
    """BraveProvider should issue multiple requests when limit > page capacity."""

    async def test_single_page_for_small_limit(self):
        from src.search.providers.brave import BraveProvider

        provider = BraveProvider("fake-key")
        raw = _make_results("p0", 60)

        with respx.mock(assert_all_called=False) as mock:
            route = mock.get("https://api.search.brave.com/res/v1/images/search").mock(
                return_value=httpx.Response(200, json={"results": raw})
            )

            results = await provider.search("monet art", limit=30)

        assert len(results) == 30
        # Only one HTTP call needed for limit=30
        assert route.called
        assert len(route.calls) == 1

    async def test_multiple_pages_for_large_limit(self):
        from src.search.providers.brave import BraveProvider

        provider = BraveProvider("fake-key")
        page0 = _make_results("p0", 100)
        page1 = _make_results("p1", 100)

        call_count = 0

        def response_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            offset = int(request.url.params.get("offset", 0))
            data = page1 if offset > 0 else page0
            return httpx.Response(200, json={"results": data})

        with respx.mock(assert_all_called=False) as mock:
            mock.get("https://api.search.brave.com/res/v1/images/search").mock(
                side_effect=response_handler
            )

            results = await provider.search("monet art", limit=120)

        assert len(results) == 120
        # Should have made at least 2 calls to collect 120 items
        assert call_count >= 2

    async def test_stops_when_provider_has_no_more_results(self):
        from src.search.providers.brave import BraveProvider

        provider = BraveProvider("fake-key")
        # Brave returns only 40 items — less than limit=100
        raw = _make_results("p0", 40)

        with respx.mock(assert_all_called=False) as mock:
            route = mock.get("https://api.search.brave.com/res/v1/images/search").mock(
                return_value=httpx.Response(200, json={"results": raw})
            )

            results = await provider.search("monet art", limit=100)

        # Should return whatever Brave gave us, not fail or hang
        assert len(results) == 40
        assert route.called
        assert len(route.calls) == 1

    async def test_empty_page_stops_pagination(self):
        from src.search.providers.brave import BraveProvider

        provider = BraveProvider("fake-key")
        page0 = _make_results("p0", 100)
        page_empty: list = []

        responses = iter([page0, page_empty])

        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"results": next(responses)})

        with respx.mock(assert_all_called=False) as mock:
            route = mock.get("https://api.search.brave.com/res/v1/images/search").mock(
                side_effect=handler
            )

            results = await provider.search("monet art", limit=150)

        # Gets page0 results, then sees empty page and stops
        assert len(results) <= 100
        assert route.called

    async def test_http_error_on_second_page_returns_partial(self):
        from src.search.providers.brave import BraveProvider

        provider = BraveProvider("fake-key")
        page0 = _make_results("p0", 100)

        call_count = 0

        def handler(_: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return httpx.Response(200, json={"results": page0})
            return httpx.Response(429, json={"error": "rate limited"})

        with respx.mock(assert_all_called=False) as mock:
            mock.get("https://api.search.brave.com/res/v1/images/search").mock(
                side_effect=handler
            )

            results = await provider.search("monet art", limit=150)

        # Should gracefully return what it got from page 0
        assert len(results) > 0
        assert len(results) <= 100

    async def test_dedup_across_pages(self):
        from src.search.providers.brave import BraveProvider

        provider = BraveProvider("fake-key")
        # Same URLs on both pages
        page0 = _make_results("shared", 50)
        page1 = _make_results("shared", 50)  # exact same image_urls

        responses = iter([page0, page1])

        def handler(_: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"results": next(responses)})

        with respx.mock(assert_all_called=False) as mock:
            mock.get("https://api.search.brave.com/res/v1/images/search").mock(
                side_effect=handler
            )

            results = await provider.search("monet art", limit=80)

        urls = [r.image_url for r in results]
        assert len(urls) == len(set(urls)), "duplicate URLs must be filtered"

    async def test_max_limit_200(self):
        from src.search.providers.brave import BraveProvider

        provider = BraveProvider("fake-key")

        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            offset = int(request.url.params.get("offset", 0))
            # Each page has 100 unique items
            raw = _make_results(f"page{offset}", 100)
            return httpx.Response(200, json={"results": raw})

        with respx.mock(assert_all_called=False) as mock:
            mock.get("https://api.search.brave.com/res/v1/images/search").mock(
                side_effect=handler
            )

            results = await provider.search("monet art", limit=200)

        assert len(results) == 200
        assert call_count >= 2
