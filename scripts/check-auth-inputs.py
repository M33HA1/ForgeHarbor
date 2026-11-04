#!/usr/bin/env python3
"""Check Auth credential/body boundaries with scoped local fixtures."""
import importlib.util
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pymongo
from dotenv import dotenv_values


def main():
    root = Path(__file__).resolve().parents[1]
    spec = importlib.util.spec_from_file_location('auth_fixture_helpers', root / 'scripts/check-auth-flow.py')
    helpers = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helpers)
    values = dotenv_values(root / 'config/.env')
    get = lambda key, default: os.environ.get(key) or values.get(key) or default
    base = os.environ.get('AUTH_DIRECT_URL', 'http://localhost:8080').rstrip('/')
    if urlparse(base).hostname not in ('localhost', '127.0.0.1'):
        raise RuntimeError('Credential fixtures require a local Auth URL.')
    mongo = urlparse(get('MONGO_URI', 'mongodb://localhost:27017'))
    if mongo.username or mongo.hostname not in ('localhost', '127.0.0.1', 'fh-mongo'):
        raise RuntimeError('Credential fixtures require local development MongoDB.')
    if mongo.hostname == 'fh-mongo':
        mongo = mongo._replace(netloc='localhost:27017')
    client = pymongo.MongoClient(urlunparse(mongo), serverSelectionTimeoutMS=5000)
    users = client.forgeharbor.users
    run_id = uuid.uuid4().hex
    emails = []
    test_ip = '198.51.100.44'
    signup_base = os.environ.get('AUTH_RATE_TEST_URL', 'http://localhost:8086').rstrip('/')
    if urlparse(signup_base).hostname not in ('localhost', '127.0.0.1', '::1'):
        raise RuntimeError('Credential signup fixtures require a loopback Auth proxy.')
    redis_url = get('REDIS_URL', 'redis://localhost:6379')

    def email(suffix):
        value = f'auth-input-{run_id}-{suffix}@example.invalid'
        emails.append(value)
        return value

    def unique_password(suffix):
        return f'Auth-fixture-{run_id}-{suffix}-only!'

    def request(path, payload=None, raw=None):
        body = raw if raw is not None else json.dumps(payload, ensure_ascii=False).encode()
        target_base = signup_base if path == '/auth/signup' else base
        req = urllib.request.Request(target_base + path, data=body, method='POST',
            headers={'Content-Type': 'application/json', 'X-Forwarded-For': test_ip})
        try:
            response = urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            content = response.read()
            return response.status, content

    def expect(status, path, payload=None, raw=None):
        actual, content = request(path, payload, raw)
        if actual != status:
            raise RuntimeError(f'Credential boundary returned HTTP {actual}; expected {status}.')
        return content

    try:
        client.admin.command('ping')
        for suffix, password in [('empty', ''), ('short', 'a' * 14), ('unicode-short', '🛟' * 14), ('long', 'a' * 129)]:
            expect(400, '/auth/signup', {'email': email(suffix), 'password': password})
        malformed_email = f'auth-input-{run_id}-missing-at'
        emails.append(malformed_email)
        expect(400, '/auth/signup', {'email': malformed_email, 'password': 'long fixture passphrase'})
        if users.count_documents({'email': {'$in': emails}}):
            raise RuntimeError('Invalid credentials created an account.')
        expect(413, '/auth/signup', {'email': email('body-size'), 'password': 'x' * 9000})
        response = expect(400, '/auth/signup', raw=b'{"password":"auth-json-rejection-fixture')
        if b'auth-json-rejection-fixture' in response:
            raise RuntimeError('JSON error response exposed request content.')

        compromised = expect(400, '/auth/signup', {
            'email': email('known-compromised'),
            'password': 'correcthorsebatterystaple',
        })
        if b'known data breaches' not in compromised:
            raise RuntimeError('A known compromised password was not rejected with the password-policy response.')

        fixtures = [
            ('minimum', f'Z!{run_id[:13]}'),
            ('unicode-maximum', '🛟' + run_id * 3 + 'x' * 31),
            ('unique', unique_password('signup')),
        ]
        for suffix, password in fixtures:
            account = email(suffix)
            expect(201, '/auth/signup', {'email': account, 'password': password})
            stored = users.find_one({'email': account})
            if not stored or not stored.get('password_hash', '').startswith('$argon2id$') or 'password' in stored:
                raise RuntimeError('Accepted credentials did not persist only an Argon2id hash.')
            expect(200, '/auth/login', {'email': account, 'password': password})
            # Login must verify an existing shorter secret rather than applying
            # the new-signup minimum; this wrong short secret reaches 401.
            expect(401, '/auth/login', {'email': account, 'password': 'short'})
            expect(400, '/auth/login', {'email': account, 'password': 'x' * 1025})
        print('Auth input boundaries passed (new password/email policy, Unicode limits, JSON cap, legacy login input, redacted errors).')
    finally:
        try:
            users.delete_many({'email': {'$in': emails}})
            if users.count_documents({'email': {'$in': emails}}):
                raise RuntimeError('Credential fixture users remain after cleanup.')
            helpers.redis_delete(redis_url, [*(helpers.account_rate_key(value) for value in emails), helpers.ip_rate_key(test_ip), helpers.signup_rate_key(test_ip)])
        finally:
            client.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        message = str(error) if isinstance(error, RuntimeError) else 'unexpected local fixture error'
        sys.exit('Auth input check failed: ' + message)
