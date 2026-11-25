"""Saving and loading model bundles in app/services/model_store.py."""

import logging

import pytest

from app.core.config import settings
from app.services import model_store
from app.services.training import predict_with_confidence, train_model
from tests.fixtures import GROCERIES, training_rows


@pytest.fixture(autouse=True)
def model_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_data_dir", str(tmp_path))
    return tmp_path


def model_file(model_dir, user_id=1, account_id=7):
    return model_dir / f"model_user_{user_id}_account_{account_id}.joblib"


def test_missing_model_is_none():
    assert model_store.load_model_bundle(user_id=1, account_id=7) is None


def test_saved_bundle_round_trips_and_still_predicts(model_dir):
    bundle = train_model(training_rows(), user_id=1, account_id=7)["bundle"]

    model_store.save_model_bundle(user_id=1, account_id=7, bundle=bundle)
    loaded = model_store.load_model_bundle(user_id=1, account_id=7)

    assert model_file(model_dir).exists()
    assert loaded["metadata"] == bundle["metadata"]
    assert predict_with_confidence(loaded, ["COMPRA MERCADONA 9999"])[0] == [GROCERIES]


def test_models_are_kept_per_user_and_account(model_dir):
    bundle = train_model(training_rows(), user_id=1, account_id=7)["bundle"]
    model_store.save_model_bundle(user_id=1, account_id=7, bundle=bundle)

    assert model_store.load_model_bundle(user_id=2, account_id=7) is None
    assert model_store.load_model_bundle(user_id=1, account_id=8) is None


@pytest.mark.parametrize(
    "content",
    [
        b"",  # truncated to nothing
        b"not a pickle at all",
        b"\x80\x05\x95\x10\x00\x00\x00",  # pickle header, then cut off
        # A pickle that references a class that no longer exists, as happens
        # when a library moves or renames something between versions.
        b"\x80\x04\x95\x1f\x00\x00\x00\x00\x00\x00\x00\x8c\x08sklearn_\x94\x8c\x07Removed\x94\x93\x94.",
    ],
    ids=["empty", "garbage", "truncated", "missing-class"],
)
def test_unloadable_model_counts_as_missing_and_is_logged(model_dir, caplog, content):
    model_file(model_dir).write_bytes(content)

    with caplog.at_level(logging.WARNING, logger="app.services.model_store"):
        assert model_store.load_model_bundle(user_id=1, account_id=7) is None

    assert "user 1 account 7" in caplog.text
    assert model_file(model_dir).exists()  # left for retraining to overwrite


def test_retraining_replaces_an_unloadable_model(model_dir):
    model_file(model_dir).write_bytes(b"not a pickle at all")
    bundle = train_model(training_rows(), user_id=1, account_id=7)["bundle"]

    model_store.save_model_bundle(user_id=1, account_id=7, bundle=bundle)

    assert model_store.load_model_bundle(user_id=1, account_id=7)["metadata"] == bundle["metadata"]
