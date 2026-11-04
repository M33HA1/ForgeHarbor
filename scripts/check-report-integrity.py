#!/usr/bin/env python3
"""Local disposable scan/report fixture; verify stored evidence and clean S3/DB."""
import json
import os
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import jwt
import pymongo
from bson import ObjectId
from dotenv import dotenv_values
from local_fixture_storage import LocalReportStore


def main():
    root = Path(__file__).resolve().parents[1]
    values = dotenv_values(root / "config/.env")
    get = lambda key, default: os.environ.get(key) or values.get(key) or default
    mongo_uri = urlparse(get("MONGO_URI", "mongodb://localhost:27017"))
    if mongo_uri.hostname == "fh-mongo":
        if mongo_uri.username:
            raise RuntimeError("Use a local test MongoDB configuration without production credentials.")
        mongo_uri = mongo_uri._replace(netloc="localhost:27017")
    if mongo_uri.hostname not in ("localhost", "127.0.0.1"):
        raise RuntimeError("This fixture only supports local test infrastructure.")
    store = LocalReportStore()
    s3 = store.request
    base = "http://localhost:8088/reports"
    owner = "report-integrity-" + uuid.uuid4().hex
    other_owner = owner + "-other"
    scan_ids = [ObjectId() for _ in range(4)]
    legacy_report_id = ObjectId()
    legacy_report_key = "unverified-legacy-" + uuid.uuid4().hex + ".json"
    client = pymongo.MongoClient(urlunparse(mongo_uri), serverSelectionTimeoutMS=5000)
    db = client[get("MONGO_DB", "forgeharbor")]
    now = int(time.time())
    key = (root / "apps/auth-rs/config/jwt-private.pem").read_bytes()

    def token(subject):
        return jwt.encode({"sub": subject, "email": "report-integrity@example.invalid", "iat": now, "exp": now + 300,
                           "iss": get("JWT_ISSUER", "forgeharbor"), "aud": get("JWT_AUDIENCE", "forgeharbor-users")}, key, algorithm="RS256")

    def request(path="", payload=None, subject=owner):
        headers = {"Authorization": "Bearer " + token(subject)}
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode()
        req = urllib.request.Request(base + path, data=body, headers=headers)
        try:
            response = urllib.request.urlopen(req, timeout=25)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}

    try:
        assert s3("HEAD") == 200, "Local S3 access must be verified before creating objects."
        db.scans.insert_many([
            {"_id": scan_ids[0], "user_id": owner, "scan_type": "file", "input": "evidence.bin", "result": {"malicious": True, "risk_level": "high"}, "created_at": datetime.now(timezone.utc), "internal_debug": "do not export"},
            {"_id": scan_ids[1], "user_id": other_owner, "scan_type": "url", "input": "https://example.invalid", "result": {"phishing": True}, "created_at": datetime.now(timezone.utc)},
            {"_id": scan_ids[2], "user_id": owner, "scan_type": "file", "input": "pending.bin", "created_at": datetime.now(timezone.utc)},
            {"_id": scan_ids[3], "user_id": owner, "scan_type": "url", "input": "https://evidence.example.invalid", "result": {"phishing": True, "risk_level": "high"}, "created_at": datetime.now(timezone.utc).isoformat()},
        ])
        # Start with a forgery attempt so the old caller-content implementation
        # demonstrably fails on downloaded evidence, rather than only validation.
        for payload, scan_index, flag in [
            ({"scanId": str(scan_ids[0]), "content": '{"result":{"malicious":false,"risk_level":"low"}}'}, 0, "malicious"),
            ({"scanId": str(scan_ids[3])}, 3, "phishing"),
        ]:
            status, report = request(payload=payload)
            assert status == 200, f"Owned scan report returned HTTP {status}."
            assert report.get("source") == "stored-scan-v1", "New report provenance was not recorded."
            assert "notification_pending" not in report, "Internal outbox state leaked into the API."
            status, artifact = request("/" + report["id"] + "/download")
            assert status == 200 and artifact.get("result", {}).get(flag) is True, "Downloaded report trusted forged caller content instead of stored scan evidence."
            assert artifact.get("_id", {}).get("$oid") == str(scan_ids[scan_index]) and artifact.get("user_id") == owner, "Report scan identity changed."
            assert "internal_debug" not in artifact, "Internal scan fields leaked into the artifact."
            assert request("/" + report["id"] + "/download", subject=other_owner)[0] == 404, "Foreign report download was allowed."
        for scan_id, expected in [("malformed", 400), (str(ObjectId()), 404), (str(scan_ids[1]), 404), (str(scan_ids[2]), 409)]:
            status, _ = request(payload={"scanId": scan_id, "content": "{}"})
            assert status == expected, f"Scan validation returned HTTP {status}; expected {expected}."
        assert request(payload={"scanId": str(scan_ids[0]), "content": "x" * 70000})[0] == 413, "Oversized create request was accepted."
        assert db.reports.count_documents({"user_id": owner}) == 2, "Denied requests created report metadata."

        db.reports.insert_one({
            "_id": legacy_report_id, "user_id": owner, "scanId": "legacy-scan",
            "key": legacy_report_key, "createdAt": datetime.now(timezone.utc),
        })
        legacy_status, legacy_error = request("/" + str(legacy_report_id) + "/download")
        assert legacy_status == 410 and "generate a new report" in legacy_error.get("error", ""), "Legacy artifact without trusted provenance was not denied."

        deadline = time.monotonic() + 5
        while db.notifications.count_documents({"user": owner}) < 2 and time.monotonic() < deadline:
            time.sleep(0.1)
        assert db.notifications.count_documents({"user": owner}) == 2, "Report notification delivery was not observed before cleanup."
        deadline = time.monotonic() + 15
        while db.reports.count_documents({"user_id": owner, "notification_pending": True}) and time.monotonic() < deadline:
            time.sleep(0.1)
        assert db.reports.count_documents({"user_id": owner, "notification_pending": False, "notification_published_at": {"$exists": True}}) == 2, "Outbox rows were not confirmed and marked published."
        # Reproduce the crash window after publish/consumer persistence but before
        # the producer's MongoDB marker: replay the same stored event identity.
        replay = db.reports.find_one({"user_id": owner})
        db.reports.update_one({"_id": replay["_id"]}, {"$set": {"notification_pending": True}, "$unset": {"notification_published_at": ""}})
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            replay = db.reports.find_one({"_id": replay["_id"]})
            if replay.get("notification_pending") is False and replay.get("notification_published_at"):
                break
            time.sleep(0.1)
        assert replay.get("notification_pending") is False and replay.get("notification_published_at"), "Pending outbox event did not recover."
        time.sleep(1)
        assert db.notifications.count_documents({"user": owner}) == 2, "Outbox replay duplicated a notification."
    finally:
        cleanup_errors = []
        try:
            for report in db.reports.find({"user_id": owner}):
                if report.get("key") == legacy_report_key:
                    continue
                if s3("DELETE", report["key"]) not in (200, 204) or s3("HEAD", report["key"]) != 404:
                    cleanup_errors.append("S3 object cleanup failed")
        finally:
            db.reports.delete_many({"user_id": owner})
            db.scans.delete_many({"_id": {"$in": scan_ids}})
            db.notifications.delete_many({"user": {"$in": [owner, other_owner]}})
            if db.reports.count_documents({"user_id": owner}) or db.scans.count_documents({"_id": {"$in": scan_ids}}) or db.notifications.count_documents({"user": owner}):
                cleanup_errors.append("Disposable database fixture cleanup failed")
            client.close()
        if cleanup_errors:
            raise RuntimeError(cleanup_errors[0])
    print("Report integrity check passed (stored evidence, ownership, confirmed outbox replay, notification idempotency, S3/DB cleanup).")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Unexpected transport/config errors can include credentials in URLs.
        message = str(exc) if isinstance(exc, (AssertionError, RuntimeError)) else f"unexpected local integration error ({type(exc).__name__})"
        raise SystemExit("Report integrity check failed: " + message) from None
