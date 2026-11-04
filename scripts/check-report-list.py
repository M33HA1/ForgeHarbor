#!/usr/bin/env python3
"""Verify the Reports scan lookup is authenticated, owner-scoped, and self-cleaning."""

import hashlib
import json
import os
import secrets
import socket
import ssl
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlencode, urlparse, urlunparse

import pymongo
from bson import ObjectId
from dotenv import dotenv_values


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    env_file = root / "config" / ".env"
    values = dotenv_values(env_file) if env_file.exists() else {}
    get = lambda key, default: os.environ.get(key) or values.get(key) or default
    mongo_uri = get("MONGO_URI", "mongodb://localhost:27017")
    parsed_uri = urlparse(mongo_uri)
    if parsed_uri.hostname == "fh-mongo":
        userinfo = f"{parsed_uri.username}:{parsed_uri.password}@" if parsed_uri.username else ""
        port = f":{parsed_uri.port}" if parsed_uri.port else ""
        mongo_uri = urlunparse(parsed_uri._replace(netloc=f"{userinfo}localhost{port}"))
    db_name = get("MONGO_DB", "forgeharbor")
    redis_url = get("REDIS_URL", "redis://localhost:6379")
    auth_base = os.environ.get("AUTH_DIRECT_URL", "http://localhost:8080").rstrip("/")
    signup_base = os.environ.get("AUTH_RATE_TEST_URL", "http://localhost:8086").rstrip("/")
    reports_base = os.environ.get("REPORTS_BASE_URL", "http://localhost:8088/reports").rstrip("/")
    run_id = uuid.uuid4().hex
    password = secrets.token_urlsafe(32)
    emails = [f"codex-report-list-{run_id}-{index}@example.invalid" for index in range(2)]
    user_ids: list[str] = []
    test_ip = "198.51.100.91"
    scan_id = f"report-list-{run_id}"
    rate_keys = [*(account_rate_key(email) for email in emails), ip_rate_key(test_ip), signup_rate_key(test_ip)]
    client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    auth_users = client["forgeharbor"]["users"]
    reports = client[db_name]["reports"]

    def request(base: str, path: str, method: str = "GET", payload=None, token=None, extra_headers=None, return_headers=False):
        body = json.dumps(payload).encode() if payload is not None else None
        headers = {"Content-Type": "application/json"} if body is not None else {}
        headers.update(extra_headers or {})
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(f"{base}{path}", data=body, headers=headers, method=method)
        try:
            response = urllib.request.urlopen(req, timeout=8)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            try:
                parsed = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                parsed = {}
            if return_headers:
                return response.status, parsed, response.headers
            return response.status, parsed

    try:
        redis_delete(redis_url, [ip_rate_key(test_ip)])
        tokens = []
        for email in emails:
            status, created = request(signup_base, "/auth/signup", "POST", {"email": email, "password": password}, extra_headers={"X-Forwarded-For": test_ip})
            if status != 201 or not created.get("user_id"):
                raise RuntimeError(f"Disposable Auth signup returned HTTP {status}.")
            user_ids.append(created["user_id"])
            status, login, login_headers = request(
                auth_base,
                "/auth/login",
                "POST",
                {"email": email, "password": password},
                extra_headers={"X-Forwarded-For": test_ip},
                return_headers=True,
            )
            cookie_header = login_headers.get("Set-Cookie", "")
            token = cookie_header.partition(";")[0].partition("=")[2] if cookie_header.startswith("fh_access=") else ""
            if status != 200 or not token or "access_token" in login:
                raise RuntimeError(f"Disposable Auth login returned HTTP {status}.")
            tokens.append(token)

        report_ids = [ObjectId(), ObjectId()]
        reports.insert_many([
            {"_id": report_ids[index], "user_id": user_ids[index], "scanId": scan_id, "key": f"fixture-{index}", "createdAt": datetime.now(timezone.utc)}
            for index in range(2)
        ])
        query = "?" + urlencode([("scan_id", scan_id), ("scan_id", f"{scan_id}-unmatched")])
        status, _ = request(reports_base, query)
        if status != 401:
            raise RuntimeError(f"Anonymous report list returned HTTP {status}; expected 401.")
        status, _ = request(reports_base, query, token="forged.token.value")
        if status != 401:
            raise RuntimeError(f"Forged-token report list returned HTTP {status}; expected 401.")
        status, _ = request(reports_base, "", token=tokens[0])
        if status != 400:
            raise RuntimeError(f"Report list without scan IDs returned HTTP {status}; expected 400.")
        status, _ = request(reports_base, "/not-an-object-id", token=tokens[0])
        if status != 400:
            raise RuntimeError(f"Malformed report ID returned HTTP {status}; expected 400.")

        for owner_index in range(2):
            status, result = request(reports_base, query, token=tokens[owner_index])
            visible_ids = {report.get("id") for report in result} if isinstance(result, list) else set()
            expected_id = report_ids[owner_index].binary.hex()
            if status != 200 or visible_ids != {expected_id}:
                raise RuntimeError(f"Owner-scoped report list for fixture {owner_index} was unexpected (HTTP {status}).")

        own_report_id = report_ids[0].binary.hex()
        status, own_report = request(reports_base, f"/{own_report_id}", token=tokens[0])
        if status != 200 or own_report.get("id") != own_report_id:
            raise RuntimeError(f"Owner report metadata returned HTTP {status} or an unexpected report.")
        other_report_id = report_ids[1].binary.hex()
        status, _ = request(reports_base, f"/{other_report_id}", token=tokens[0])
        if status != 404:
            raise RuntimeError(f"Cross-user report metadata returned HTTP {status}; expected 404.")
        status, _ = request(reports_base, f"/{other_report_id}/download", token=tokens[0])
        if status != 404:
            raise RuntimeError(f"Cross-user report download returned HTTP {status}; expected 404.")

        empty_query = "?" + urlencode({"scan_id": f"{scan_id}-unmatched"})
        status, result = request(reports_base, empty_query, token=tokens[0])
        if status != 200 or result != []:
            raise RuntimeError(f"Empty report lookup returned HTTP {status} or an unexpected result.")
        print("Reports integration check passed (owner-scoped lists, metadata/download denial, malformed IDs, empty result).")
    finally:
        try:
            reports.delete_many({"scanId": scan_id, "user_id": {"$in": user_ids}})
            auth_users.delete_many({"email": {"$in": emails}})
            redis_delete(redis_url, rate_keys)
        finally:
            client.close()


def account_rate_key(email: str) -> str:
    digest = hashlib.sha256(email.strip().lower().encode()).hexdigest()
    return f"forgeharbor:auth:login:v1:account:{digest}"


def ip_rate_key(ip: str) -> str:
    digest = hashlib.sha256(ip.strip().lower().encode()).hexdigest()
    return f"forgeharbor:auth:login:v1:ip:{digest}"


def signup_rate_key(ip: str) -> str:
    digest = hashlib.sha256(ip.strip().lower().encode()).hexdigest()
    return f"forgeharbor:auth:signup:v1:ip:{digest}"


def redis_delete(redis_url: str, keys: list[str]) -> None:
    parsed = urlparse(redis_url)
    host = "localhost" if parsed.hostname == "fh-redis" else (parsed.hostname or "localhost")
    port = parsed.port or 6379
    redis_socket = socket.create_connection((host, port), timeout=5)
    if parsed.scheme == "rediss":
        redis_socket = ssl.create_default_context().wrap_socket(redis_socket, server_hostname=host)
    with redis_socket:
        stream = redis_socket.makefile("rb")

        def command(*parts: str) -> bytes:
            encoded = [part.encode() for part in parts]
            payload = f"*{len(encoded)}\r\n".encode()
            payload += b"".join(f"${len(part)}\r\n".encode() + part + b"\r\n" for part in encoded)
            redis_socket.sendall(payload)
            return stream.readline()

        if parsed.password:
            username = unquote(parsed.username) if parsed.username else None
            password = unquote(parsed.password)
            auth_reply = command("AUTH", username, password) if username else command("AUTH", password)
            if not auth_reply.startswith(b"+OK"):
                raise RuntimeError("Redis test cleanup authentication failed.")
        database = parsed.path.strip("/")
        if database and database != "0" and not command("SELECT", database).startswith(b"+OK"):
            raise RuntimeError("Redis test cleanup database selection failed.")
        if not command("DEL", *keys).startswith(b":"):
            raise RuntimeError("Redis test counter cleanup failed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        message = str(exc) if isinstance(exc, RuntimeError) else "unexpected local integration error"
        if "mongodb://" in message or "mongodb+srv://" in message:
            message = "unexpected local integration error"
        raise SystemExit(f"Reports list integration check failed: {message}") from None
