import pytest


@pytest.mark.asyncio
class TestMockProvider:
    async def test_returns_correct_count(self):
        from src.search.providers.mock import MockProvider

        provider = MockProvider()
        results = await provider.search("Egon Schiele", 5)
        assert len(results) == 5

    async def test_urls_start_with_mock(self):
        from src.search.providers.mock import MockProvider

        provider = MockProvider()
        results = await provider.search("Test Artist", 3)
        for r in results:
            assert r.image_url.startswith("mock://")

    async def test_deterministic_same_query_yields_same_urls(self):
        from src.search.providers.mock import MockProvider

        p1 = MockProvider()
        p2 = MockProvider()
        r1 = await p1.search("Van Gogh", 10)
        r2 = await p2.search("Van Gogh", 10)
        assert [x.image_url for x in r1] == [x.image_url for x in r2]

    async def test_different_queries_yield_different_urls(self):
        from src.search.providers.mock import MockProvider

        p = MockProvider()
        r1 = await p.search("Monet", 5)
        r2 = await p.search("Picasso", 5)
        assert r1[0].image_url != r2[0].image_url

    async def test_never_makes_network_calls(self):
        from src.search.providers.mock import MockProvider

        provider = MockProvider()
        results = await provider.search("Any Artist", 3)
        assert all(r.image_url.startswith("mock://") for r in results)
        assert len(results) == 3

    async def test_results_have_all_fields_optional(self):
        from src.search.providers.mock import MockProvider

        provider = MockProvider()
        results = await provider.search("Test", 1)
        r = results[0]
        assert isinstance(r.image_url, str)
        # title, page_url, width, height can be None in mock
