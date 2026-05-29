import pytest
from datetime import datetime
from src.common.pagination import CursorPage, encode_cursor, decode_cursor

def test_cursor_page():
    page = CursorPage(items=[1, 2, 3], next_cursor="abc", total=3)
    assert page.items == [1, 2, 3]
    assert page.next_cursor == "abc"
    assert page.total == 3

def test_encode_decode_cursor():
    dt = datetime(2024, 1, 1, 12, 0, 0)
    cursor = encode_cursor(dt)
    assert isinstance(cursor, str)
    assert decode_cursor(cursor) == dt
