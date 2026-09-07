"""
Records store a provider-independent storage key, not a delivery URL.

These pin the two conversions that make that work - reducing an incoming
reference to what gets persisted, and building the URL a browser loads - plus
the legacy shapes that must survive both untouched.
"""

import importlib

import pytest


ACTIVE_CLOUD = "sgtiseox"
RETIRED_CLOUD = "oldcloud"

KEY = "sm-visitor/photos/3f2a9b_visitor"
ACTIVE_URL = f"https://res.cloudinary.com/{ACTIVE_CLOUD}/image/upload/v1788157394/{KEY}.jpg"
RETIRED_URL = f"https://res.cloudinary.com/{RETIRED_CLOUD}/image/upload/v1712345678/{KEY}.jpg"
GRIDFS_ID = "68b0f1c2d3e4f5a6b7c8d9e0"
BUFFER_PATH = "/uploads/buffer/abc123_visitor.jpg"
# The same thing, as other hosts actually recorded it.
BUFFER_PATH_SHAPES = [
    BUFFER_PATH,
    "./uploads/buffer/c866d0c7-2f47-4682-9499-59432df63012.jpg",
    "./uploads\\buffer\\26890e31-4b20-48ec-acb9-402d34c0c6c7.JPG",
    "uploads/buffer/abc123_visitor.jpg",
]


@pytest.fixture
def refs(monkeypatch):
    """photo_urls reads its provider settings at import, so reload it here."""
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", ACTIVE_CLOUD)
    monkeypatch.setenv("CLOUDINARY_RETIRED_CLOUD_NAMES", RETIRED_CLOUD)
    monkeypatch.setenv("PHOTO_PROVIDER", "cloudinary")

    import config
    import utils.photo_urls as photo_urls

    importlib.reload(config)
    yield importlib.reload(photo_urls)

    importlib.reload(config)
    importlib.reload(photo_urls)


# ── Persisting a reference ───────────────────────────────────────────────────

def test_a_live_url_is_reduced_to_a_key(refs):
    assert refs.normalize_photo_ref(ACTIVE_URL) == KEY


def test_a_url_carrying_transformations_still_yields_the_bare_key(refs):
    url = f"https://res.cloudinary.com/{ACTIVE_CLOUD}/image/upload/c_limit,w_256,q_auto/v1788157394/{KEY}.jpg"
    assert refs.normalize_photo_ref(url) == KEY


def test_a_key_is_left_alone(refs):
    assert refs.normalize_photo_ref(KEY) == KEY


@pytest.mark.parametrize("path", BUFFER_PATH_SHAPES)
def test_every_shape_of_buffer_path_is_recognised(refs, path):
    # Missing one means it is taken for a storage key, and a delivery URL gets
    # built around a path that was only ever on a container's local disk.
    assert refs.is_local_buffer_path(path) is True
    assert refs.is_storage_key(path) is False
    assert refs.to_delivery_url(path) == path
    assert refs.normalize_photo_ref(path) == path


def test_a_dot_in_the_public_id_is_not_mistaken_for_an_extension(refs):
    # Photos imported under their original filename keep it as the public id,
    # and those carry dots. Stripping everything after the last one truncated
    # the key to an asset that does not exist.
    dotted = "sm-visitor/photos/WhatsApp Image 2026-01-27 at 22.43.04"
    url = f"https://res.cloudinary.com/{ACTIVE_CLOUD}/image/upload/{dotted}.jpg"
    assert refs.normalize_photo_ref(url) == dotted
    assert refs.normalize_photo_ref(f"https://res.cloudinary.com/{ACTIVE_CLOUD}/image/upload/{dotted}") == dotted


def test_a_retired_url_is_kept_so_it_keeps_reporting_as_unreachable(refs):
    # Reducing it to a key would rebuild it against the live account and
    # silently claim the photo is fine.
    assert refs.normalize_photo_ref(RETIRED_URL) == RETIRED_URL
    assert refs.is_unreachable_photo_url(RETIRED_URL) is True


@pytest.mark.parametrize("legacy", [GRIDFS_ID, BUFFER_PATH])
def test_legacy_shapes_survive_persisting(refs, legacy):
    assert refs.normalize_photo_ref(legacy) == legacy


# ── Building a delivery URL ──────────────────────────────────────────────────

def test_a_key_becomes_a_url_for_the_configured_account(refs):
    built = refs.to_delivery_url(KEY)
    assert built == f"https://res.cloudinary.com/{ACTIVE_CLOUD}/image/upload/{KEY}"


def test_the_round_trip_is_lossless(refs):
    assert refs.normalize_photo_ref(refs.to_delivery_url(KEY)) == KEY


def test_switching_account_repoints_every_stored_key(refs, monkeypatch):
    """The whole point: the database does not change, the URL does."""
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "some-other-host")
    import config
    import utils.photo_urls as photo_urls

    importlib.reload(config)
    reloaded = importlib.reload(photo_urls)

    assert reloaded.to_delivery_url(KEY).startswith(
        "https://res.cloudinary.com/some-other-host/image/upload/"
    )


@pytest.mark.parametrize("legacy", [GRIDFS_ID, BUFFER_PATH, RETIRED_URL, ACTIVE_URL])
def test_non_keys_pass_through_url_building_untouched(refs, legacy):
    # The apps already know how to resolve a GridFS id and a /uploads path,
    # and a URL is a URL.
    assert refs.to_delivery_url(legacy) == legacy


def test_both_conversions_are_idempotent(refs):
    for value in (KEY, ACTIVE_URL, RETIRED_URL, GRIDFS_ID, BUFFER_PATH):
        once = refs.to_delivery_url(value)
        assert refs.to_delivery_url(once) == once
        stored = refs.normalize_photo_ref(value)
        assert refs.normalize_photo_ref(stored) == stored


@pytest.mark.parametrize("empty", [None, "", "   "])
def test_empty_values_are_returned_as_given(refs, empty):
    assert refs.to_delivery_url(empty) == empty
    assert refs.normalize_photo_ref(empty) == empty


# ── Classification ───────────────────────────────────────────────────────────

def test_a_key_is_never_reported_unreachable(refs):
    # It is built against whichever account is live, so a missing asset shows
    # up as a failed image load in the apps rather than a server-side flag.
    assert refs.is_unreachable_photo_url(KEY) is False
    assert refs.is_unreachable_photo_url(ACTIVE_URL) is False


@pytest.mark.parametrize(
    "value,expected",
    [(KEY, True), (ACTIVE_URL, False), (GRIDFS_ID, False), (BUFFER_PATH, False)],
)
def test_storage_key_detection(refs, value, expected):
    assert refs.is_storage_key(value) is expected
