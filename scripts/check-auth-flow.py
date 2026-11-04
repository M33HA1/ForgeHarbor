#!/usr/bin/env python3
"""Exercise Auth signup/login/JWT behavior with a disposable local user."""

import json
import hashlib
import base64
import os
import re
import secrets
import socket
import ssl
from concurrent.futures import ThreadPoolExecutor
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse, urlunparse

import pymongo
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
    gateway_base = os.environ.get("AUTH_GATEWAY_URL", "http://localhost:8088").rstrip("/")
    rate_test_base = os.environ.get("AUTH_RATE_TEST_URL", "http://localhost:8086").rstrip("/")
    if urlparse(rate_test_base).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("Auth rate-limit test proxy must use a loopback host.")
    run_id = uuid.uuid4().hex
    email = f"codex-auth-check-{run_id}@example.invalid"
    race_email = f"codex-auth-race-{run_id}@example.invalid"
    password = secrets.token_urlsafe(32)
    test_ip = "198.51.100.42"
    signup_test_ip = "198.51.100.77"
    signup_fixture_ip = "198.51.100.78"
    rate_keys = [account_rate_key(email), account_rate_key(race_email), ip_rate_key(test_ip), signup_rate_key(signup_test_ip), signup_rate_key(signup_fixture_ip)]
    client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    users = client[db_name]["users"]

    def request(method: str, path: str, payload=None, token=None, cookie=None, extra_headers=None, base_url=None):
        body = json.dumps(payload).encode() if payload is not None else None
        headers = {"Content-Type": "application/json"} if body is not None else {}
        headers.update(extra_headers or {})
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        if cookie is not None:
            headers["Cookie"] = f"fh_access={cookie}"
        req = urllib.request.Request(f"{(base_url or auth_base)}{path}", data=body, headers=headers, method=method)
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
            return response.status, parsed, response.headers

    try:
        # The fixed documentation-range IP is shared between runs. Clear only its
        # hashed test bucket before exercising the account flow.
        redis_delete(redis_url, [ip_rate_key(test_ip)])
        email_index_exists = any(
            index.get("name") == "users_email_case_insensitive_unique"
            and index.get("unique")
            and index.get("key", {}).get("email") == 1
            and index.get("collation", {}).get("locale") == "en"
            and index.get("collation", {}).get("strength") == 2
            for index in users.list_indexes()
        )
        if not email_index_exists:
            raise RuntimeError("Auth case-insensitive unique email index is missing or misconfigured.")
        print("Auth check: database and case-insensitive unique index ready", flush=True)

        jwks_key_id = None
        for endpoint in (auth_base, gateway_base):
            status, jwks, _ = request("GET", "/auth/jwks", base_url=endpoint)
            keys = jwks.get("keys", [])
            if status != 200 or len(keys) != 1:
                raise RuntimeError(f"JWKS returned HTTP {status} or an unexpected key count.")
            public_key = keys[0]
            if (public_key.get("kty"), public_key.get("use"), public_key.get("alg")) != ("RSA", "sig", "RS256"):
                raise RuntimeError("JWKS did not describe an RSA signing key.")
            if not all(isinstance(public_key.get(field), str) and public_key[field] for field in ("kid", "n", "e")):
                raise RuntimeError("JWKS omitted a key ID, modulus, or exponent.")
            if "pem" in public_key or len(public_key["kid"]) != 43:
                raise RuntimeError("JWKS used a nonstandard key field or an invalid thumbprint length.")
            if jwks_key_id is not None and public_key["kid"] != jwks_key_id:
                raise RuntimeError("Direct and gateway JWKS routes returned different key IDs.")
            jwks_key_id = public_key["kid"]
        print("Auth check: standard RSA JWKS passed direct and gateway routes", flush=True)

        signup_headers = {"X-Forwarded-For": signup_fixture_ip}
        status, created, _ = request("POST", "/auth/signup", {"email": email.swapcase(), "password": password}, extra_headers=signup_headers, base_url=rate_test_base)
        if status != 201 or not created.get("user_id"):
            raise RuntimeError(f"Signup returned HTTP {status}.")
        print("Auth check: first signup completed", flush=True)

        status, _, _ = request("POST", "/auth/signup", {"email": email, "password": password}, extra_headers=signup_headers, base_url=rate_test_base)
        if status != 409:
            raise RuntimeError(f"Duplicate signup returned HTTP {status}; expected 409.")

        with ThreadPoolExecutor(max_workers=2) as executor:
            race_results = list(executor.map(
                lambda candidate: request("POST", "/auth/signup", {"email": candidate, "password": password}, extra_headers=signup_headers, base_url=rate_test_base),
                (race_email, race_email.swapcase()),
            ))
        race_statuses = sorted(status for status, _, _ in race_results)
        case_variants = {"email": {"$regex": f"^{re.escape(race_email)}$", "$options": "i"}}
        if race_statuses != [201, 409] or users.count_documents(case_variants) != 1:
            raise RuntimeError("Concurrent duplicate signup did not create exactly one user and return 201/409.")
        print("Auth check: concurrent duplicate signup completed", flush=True)
        race_user = users.find_one({"email": race_email})
        if not race_user or not race_user.get("password_hash") or "password" in race_user:
            raise RuntimeError("Concurrent signup did not persist only a password hash.")

        # A separate trusted proxy IP isolates the signup threshold from other local test traffic.
        redis_delete(redis_url, [signup_rate_key(signup_test_ip)])
        signup_headers = {"X-Forwarded-For": signup_test_ip}
        for _ in range(20):
            status, _, _ = request(
                "POST", "/auth/signup", {"email": email, "password": password},
                extra_headers=signup_headers, base_url=rate_test_base,
            )
            if status != 409:
                raise RuntimeError(f"Signup before the configured IP limit returned HTTP {status}; expected 409 for the existing fixture.")
        status, _, headers = request(
            "POST", "/auth/signup", {"email": email, "password": password},
            extra_headers=signup_headers, base_url=rate_test_base,
        )
        if status != 429 or not headers.get("Retry-After", "").isdigit():
            raise RuntimeError(f"Signup over the configured IP limit returned HTTP {status} without Retry-After.")
        print("Auth check: signup IP limit completed", flush=True)

        stored = users.find_one({"email": email})
        if not stored or stored.get("email") != email or not stored.get("password_hash") or stored.get("password_hash") == password or "password" in stored:
            raise RuntimeError("Auth did not persist only a password hash for the disposable user.")

        forwarded = {"X-Forwarded-For": test_ip}
        status, _, _ = request("POST", "/auth/login", {"email": email, "password": f"wrong-{password}"}, extra_headers=forwarded)
        if status != 401:
            raise RuntimeError(f"Invalid-password login returned HTTP {status}; expected 401.")

        status, login, login_headers = request("POST", "/auth/login", {"email": email.swapcase(), "password": password}, extra_headers=forwarded)
        cookie = login_headers.get("Set-Cookie", "")
        token = cookie.partition(";")[0].partition("=")[2] if cookie.startswith("fh_access=") else ""
        if status != 200 or not token or login.get("expires_in") != 3600 or "access_token" in login:
            raise RuntimeError(f"Valid login returned HTTP {status} or an invalid token response.")
        token_header = json.loads(base64.urlsafe_b64decode(token.split(".", 1)[0] + "==="))
        if token_header.get("kid") != jwks_key_id:
            raise RuntimeError("Issued RS256 token key ID does not match the published JWKS.")
        claims = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "==="))
        jti = claims.get("jti")
        if not isinstance(jti, str) or not jti:
            raise RuntimeError("Issued session token does not have a revocable token ID.")
        rate_keys.append(session_revocation_key(jti))
        if not cookie.startswith(f"fh_access={token};") or "HttpOnly" not in cookie or "SameSite=Strict" not in cookie:
            raise RuntimeError("Login did not issue the expected HttpOnly same-site session cookie.")
        print("Auth check: valid login completed", flush=True)

        status, current, _ = request("GET", "/auth/me", cookie=token)
        if status != 200 or current.get("user_id") != created["user_id"] or current.get("email") != email:
            raise RuntimeError(f"Authenticated /me returned HTTP {status} or an unexpected user.")
        status, current, _ = request("GET", "/auth/me", cookie=token, base_url=gateway_base)
        if status != 200 or current.get("user_id") != created["user_id"]:
            raise RuntimeError(f"Gateway cookie session returned HTTP {status} or an unexpected user.")
        status, current, _ = request("GET", "/auth/me", token=token)
        if status != 200 or current.get("user_id") != created["user_id"]:
            raise RuntimeError("Bearer-token compatibility path failed.")

        status, _, logout_headers = request("POST", "/auth/logout", cookie=token)
        if status != 204 or "Max-Age=0" not in logout_headers.get("Set-Cookie", ""):
            raise RuntimeError(f"Logout returned HTTP {status}; expected 204.")
        status, _, _ = request("GET", "/auth/me", cookie=token)
        if status != 401:
            raise RuntimeError(f"Logged-out cookie token remained valid with HTTP {status}.")
        status, _, _ = request("GET", "/auth/me", token=token)
        if status != 401:
            raise RuntimeError(f"Logged-out bearer token remained valid with HTTP {status}.")
        status, _, _ = request("GET", "/history", token=token, base_url=gateway_base)
        if status != 401:
            raise RuntimeError(f"Gateway accepted a revoked token with HTTP {status}.")

        status, _, _ = request("GET", "/auth/me", token="forged.token.value")
        if status != 401:
            raise RuntimeError(f"Forged-token /me returned HTTP {status}; expected 401.")

        for _ in range(5):
            status, _, _ = request("POST", "/auth/login", {"email": email, "password": f"wrong-{password}"}, extra_headers=forwarded)
            if status != 401:
                raise RuntimeError(f"Login attempt before the configured limit returned HTTP {status}.")
        status, _, headers = request("POST", "/auth/login", {"email": email, "password": f"wrong-{password}"}, extra_headers=forwarded)
        if status != 429 or not headers.get("Retry-After", "").isdigit():
            raise RuntimeError(f"Login attempt over the configured limit returned HTTP {status} without Retry-After.")
        print("Auth check: per-account limit completed", flush=True)

        # Clear only the unique test IP counter so the independent IP threshold can be asserted.
        redis_delete(redis_url, [ip_rate_key(test_ip)])
        rate_keys.remove(ip_rate_key(test_ip))
        rate_keys.append(ip_rate_key(test_ip))
        candidates = [f"codex-ip-limit-{run_id}-{index}@example.invalid" for index in range(60)]
        for candidate in candidates:
            rate_keys.append(account_rate_key(candidate))
        with ThreadPoolExecutor(max_workers=12) as executor:
            responses = executor.map(
                lambda candidate: request(
                    "POST", "/auth/login", {"email": candidate, "password": password},
                    extra_headers=forwarded, base_url=rate_test_base
                ),
                candidates,
            )
            statuses = [status for status, _, _ in responses]
        if statuses.count(401) != 60 or statuses.count(429) != 0:
            raise RuntimeError("IP login attempts before the configured limit did not all return HTTP 401.")
        print("Auth check: first 60 IP attempts completed", flush=True)
        final_candidate = f"codex-ip-limit-{run_id}-final@example.invalid"
        rate_keys.append(account_rate_key(final_candidate))
        status, _, headers = request(
            "POST", "/auth/login", {"email": final_candidate, "password": password},
            extra_headers=forwarded, base_url=rate_test_base
        )
        if status != 429 or not headers.get("Retry-After", "").isdigit():
            raise RuntimeError(f"IP login attempt over the configured limit returned HTTP {status} without Retry-After.")

        print("Auth integration check passed (signup race and IP limit, password hashing, forged-token rejection, per-account and per-IP login limits).")
    finally:
        try:
            test_emails = {"$in": [email, race_email]}
            users.delete_many({"email": test_emails})
            if users.count_documents({"email": test_emails}):
                raise RuntimeError("Auth test user was not removed.")
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


def session_revocation_key(jti: str) -> str:
    digest = hashlib.sha256(jti.encode()).hexdigest()
    return f"forgeharbor:auth:revoked:v1:jti:{digest}"


def redis_delete(redis_url: str, keys: list[str]) -> None:
    parsed = urlparse(redis_url)
    host = "localhost" if parsed.hostname == "fh-redis" else (parsed.hostname or "localhost")
    port = parsed.port or 6379
    password = unquote(parsed.password) if parsed.password else None
    username = unquote(parsed.username) if parsed.username else None
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

        if password:
            auth_reply = command("AUTH", username, password) if username else command("AUTH", password)
            if not auth_reply.startswith(b"+OK"):
                raise RuntimeError("Redis test cleanup authentication failed.")
        database = parsed.path.strip("/")
        if database and database != "0":
            if not command("SELECT", database).startswith(b"+OK"):
                raise RuntimeError("Redis test cleanup database selection failed.")
        if not command("DEL", *keys).startswith(b":"):
            raise RuntimeError("Redis test counter cleanup failed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Avoid including request payloads, credentials, tokens, or connection URIs.
        if isinstance(exc, RuntimeError):
            message = str(exc)
        else:
            message = "unexpected local integration error"
        if "mongodb://" in message or "mongodb+srv://" in message:
            message = "unexpected local integration error"
        raise SystemExit(f"Auth integration check failed: {message}") from None
