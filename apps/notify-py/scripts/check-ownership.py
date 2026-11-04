#!/usr/bin/env python3
"""Verify Notify only returns records owned by the authenticated RS256 subject."""

import json
import os
import re
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import jwt
import pymongo
from dotenv import dotenv_values


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    env_file = root / "config" / ".env"
    values = dotenv_values(env_file) if env_file.exists() else {}
    get = lambda key, default: os.environ.get(key) or values.get(key) or default

    mongo_uri = get("MONGO_URI", "mongodb://localhost:27017")
    parsed = urlparse(mongo_uri)
    if parsed.hostname == "fh-mongo":
        mongo_uri = urlunparse(parsed._replace(netloc=parsed.netloc.replace("fh-mongo", "localhost", 1)))
    db_name = get("MONGO_DB", "forgeharbor")
    issuer = get("JWT_ISSUER", "forgeharbor")
    audience = get("JWT_AUDIENCE", "forgeharbor-users")
    gateway = os.environ.get("GATEWAY_URL", "http://localhost:8088").rstrip("/")
    key_path = root / "apps" / "auth-rs" / "config" / "jwt-private.pem"
    if not key_path.is_file():
        raise RuntimeError("Auth private key is missing; run scripts/setup-jwt-keys.mjs first.")

    run_id = str(uuid.uuid4())
    owner_id = f"notify-check-{run_id}"
    other_id = f"notify-other-{run_id}"
    fixture_tag = "notify-ownership-check"
    token = jwt.encode(
        {"sub": owner_id, "email": "notify-owner-check@example.invalid", "iss": issuer, "aud": audience,
         "iat": int(__import__("time").time()), "exp": int(__import__("time").time()) + 300},
        key_path.read_bytes(),
        algorithm="RS256",
    )
    client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    collection = client[db_name]["notifications"]
    records = [
        {"message": f"fixture-owner-{run_id}", "user": owner_id, "timestamp": "2099-01-01T00:00:00Z", "test_fixture": fixture_tag, "test_run_id": run_id},
        {"message": f"fixture-other-{run_id}", "user": other_id, "timestamp": "2099-01-02T00:00:00Z", "test_fixture": fixture_tag, "test_run_id": run_id},
    ]
    try:
        collection.insert_many(records)
        request = urllib.request.Request(
            f"{gateway}/notify",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            if response.status != 200:
                raise RuntimeError(f"Notify returned HTTP {response.status}.")
            payload = json.loads(response.read())
        messages = [item.get("message") for item in payload.get("notifications", [])]
        if messages != [f"fixture-owner-{run_id}"]:
            raise RuntimeError("Notify did not return exactly the authenticated user's fixture.")
        print("Notify ownership integration check passed (RS256 owner sees only their fixture).")
    finally:
        collection.delete_many({"test_fixture": fixture_tag, "test_run_id": run_id})
        remaining = collection.count_documents({"test_fixture": fixture_tag, "test_run_id": run_id})
        client.close()
        if remaining:
            raise RuntimeError("Notify test fixtures were not all removed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        safe = re.sub(r"mongodb(?:\+srv)?://[^\s]+", "mongodb://<redacted>", str(exc))
        raise SystemExit(f"Notify ownership integration check failed: {safe}") from None
