"""
Unit tests for the guard-facing autofill lookup queries.

These cover the reasons a month-old visitor stopped being recalled by Orbit's
autofill: a page-size cap that silently dropped older records, an owner-only
visit history endpoint, and historical regulars being filtered out server-side.
"""
from datetime import datetime, timedelta

import pytest

import routers.visits as visits_router
import routers.visitors as visitors_router

NOW = datetime(2026, 7, 26, 12, 0, 0)
GUARD = {"role": "guard", "user_id": "guard-1"}


class FakeCursor:
    """Minimal stand-in for a Motor cursor."""

    def __init__(self, docs):
        self._docs = docs
        self.applied_limit = None

    def sort(self, key, direction):
        self._docs = sorted(
            self._docs,
            key=lambda doc: doc.get(key) or datetime.min,
            reverse=direction == -1,
        )
        return self

    def limit(self, count):
        self.applied_limit = count
        self._docs = self._docs[:count]
        return self

    async def to_list(self, length=None):
        return self._docs[:length] if length is not None else self._docs

    def __aiter__(self):
        async def generate():
            for doc in self._docs:
                yield doc

        return generate()


class FakeCollection:
    def __init__(self, docs):
        self.docs = docs
        self.last_query = None
        self.last_cursor = None

    def find(self, query=None):
        self.last_query = query
        self.last_cursor = FakeCursor(list(self.docs))
        return self.last_cursor


def make_visit(visit_id, name, phone, days_ago, **overrides):
    doc = {
        "_id": visit_id,
        "visitor_id": None,
        "name_snapshot": name,
        "phone_snapshot": phone,
        "photo_snapshot_url": "photo.jpg",
        "purpose": "Delivery",
        "owner_id": "A-101",
        "guard_id": "guard-1",
        "status": "approved",
        "created_at": NOW - timedelta(days=days_ago),
    }
    doc.update(overrides)
    return doc


def make_regular(visitor_id, name, approval_status, is_active, days_ago):
    return {
        "_id": visitor_id,
        "name": name,
        "phone": "9991110000",
        "photo_url": "photo.jpg",
        "visitor_type": "regular",
        "approval_status": approval_status,
        "is_active": is_active,
        "created_at": NOW - timedelta(days=days_ago),
        "created_by": "guard-1",
    }


@pytest.fixture
def fake_visits(monkeypatch):
    def install(docs):
        collection = FakeCollection(docs)
        monkeypatch.setattr(visits_router, "get_visits_collection", lambda: collection)
        return collection

    return install


@pytest.fixture
def fake_visitors(monkeypatch):
    def install(docs):
        collection = FakeCollection(docs)
        monkeypatch.setattr(visitors_router, "get_visitors_collection", lambda: collection)
        return collection

    return install


async def test_guard_history_returns_month_old_visit(fake_visits):
    """A visit from a month ago must still be available for autofill."""
    fake_visits(
        [
            make_visit("1", "RAMESH", "9990000001", days_ago=0),
            make_visit("2", "PAPPUBHAI", "9990000002", days_ago=31),
        ]
    )

    results = await visits_router.get_guard_visit_history(limit=1000, _current_user=GUARD)

    assert [r.name_snapshot for r in results] == ["RAMESH", "PAPPUBHAI"]


async def test_guard_history_collapses_repeat_visits_per_person(fake_visits):
    """One entry per person, keeping the most recent visit's details."""
    fake_visits(
        [
            make_visit("1", "PAPPUBHAI", "9990000002", days_ago=31),
            make_visit("2", "PAPPUBHAI", "9990000002", days_ago=40),
            make_visit("3", "pappubhai", "9990000002", days_ago=45),
            make_visit("4", "PAPPUBHAI", "9995555555", days_ago=46),
        ]
    )

    results = await visits_router.get_guard_visit_history(limit=1000, _current_user=GUARD)

    # Same name and phone collapse regardless of case; a different phone is a
    # different person.
    assert len(results) == 2
    assert results[0].created_at == NOW - timedelta(days=31)
    assert results[1].phone_snapshot == "9995555555"


async def test_guard_history_skips_unusable_documents(fake_visits):
    """Legacy documents must be skipped, not break the whole lookup."""
    no_purpose = make_visit("4", "NO_PURPOSE", "9990000012", days_ago=8)
    del no_purpose["purpose"]

    fake_visits(
        [
            make_visit("1", "VALID", "9990000001", days_ago=0),
            make_visit("2", "", "9990000009", days_ago=5),
            make_visit("3", "NULL_OWNER", "9990000011", days_ago=7, owner_id=None),
            no_purpose,
        ]
    )

    results = await visits_router.get_guard_visit_history(limit=1000, _current_user=GUARD)

    assert [r.name_snapshot for r in results] == ["VALID"]


async def test_guard_history_respects_limit_and_bounds_the_scan(fake_visits):
    collection = fake_visits(
        [make_visit(str(i), f"VISITOR{i}", f"999000{i:04d}", days_ago=i) for i in range(10)]
    )

    results = await visits_router.get_guard_visit_history(limit=3, _current_user=GUARD)

    assert len(results) == 3
    # The scan window stays bounded even though duplicates may collapse.
    assert collection.last_cursor.applied_limit == 2000


async def test_visitor_list_default_query_is_unchanged(fake_visitors):
    """Existing guard screens must keep seeing only active/pending visitors."""
    collection = fake_visitors([make_regular("v1", "ACTIVE_MAID", "approved", True, 1)])

    await visitors_router.list_visitors(
        include_inactive=False, limit=1000, current_user=GUARD
    )

    assert collection.last_query == {
        "$or": [
            {"is_active": True},
            {"visitor_type": "regular", "approval_status": "pending"},
        ]
    }


async def test_visitor_list_include_inactive_adds_historical_regulars(fake_visitors):
    """Autofill opts in to deactivated/rejected regulars; deleted stay hidden."""
    collection = fake_visitors(
        [
            make_regular("v1", "ACTIVE_MAID", "approved", True, 1),
            make_regular("v2", "OLD_REJECTED", "rejected", False, 30),
            make_regular("v3", "GONE", "deleted", False, 40),
        ]
    )

    await visitors_router.list_visitors(include_inactive=True, limit=1000, current_user=GUARD)

    assert {
        "visitor_type": "regular",
        "approval_status": {"$in": ["approved", "rejected"]},
    } in collection.last_query["$or"]
    assert "deleted" not in str(collection.last_query)


async def test_visitor_list_limit_is_passed_through(fake_visitors):
    """The old hard-coded 100 is what dropped older records."""
    docs = [make_regular(f"v{i}", f"VISITOR{i}", "approved", True, i) for i in range(150)]
    collection = fake_visitors(docs)

    results = await visitors_router.list_visitors(
        include_inactive=True, limit=1000, current_user=GUARD
    )

    assert len(results) == 150
    assert collection.last_query is not None
