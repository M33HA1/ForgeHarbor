"""Scoped lifecycle/rendering helper for the real local browser journey."""
import hashlib
import importlib.util
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pymongo
from bson import ObjectId
from dotenv import dotenv_values
from local_fixture_storage import LocalReportStore

# Reuse cleanup helpers from the existing CLI script without running its main.
_spec = importlib.util.spec_from_file_location('report_fixture_helpers', Path(__file__).with_name('check-report-list.py'))
_helpers = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_helpers)
account_rate_key, redis_delete = _helpers.account_rate_key, _helpers.redis_delete


def main():
    root = Path(__file__).resolve().parents[1]
    action = sys.argv[1]
    run_id = sys.argv[2] if len(sys.argv) > 2 else uuid.uuid4().hex
    if not re.fullmatch('[0-9a-f]{32}', run_id):
        raise RuntimeError('Invalid fixture run ID.')
    emails = [f'ui-live-{run_id}-{suffix}@example.invalid' for suffix in ['a', 'b']]
    ids = [ObjectId(hashlib.sha256((run_id + suffix).encode()).hexdigest()[:24]) for suffix in ['a', 'b']]
    config = {'runId': run_id, 'emails': emails, 'scanIds': [str(value) for value in ids],
              'targets': [f'ui-live-{run_id}-{suffix}.bin' for suffix in ['a', 'b']]}
    if action in ('render-create', 'render-verify'):
        config['phase'] = action.split('-')[1]
        source = (root / 'scripts/check-web-live.js').read_text(encoding='utf-8')
        print(json.dumps({'code': f'async (page) => await ({source})(page, {json.dumps(config)})'}))
        return
    values = dotenv_values(root / 'config/.env')
    get = lambda key, default: os.environ.get(key) or values.get(key) or default
    mongo = urlparse(get('MONGO_URI', 'mongodb://localhost:27017'))
    if mongo.username or mongo.hostname not in ('localhost', '127.0.0.1', 'fh-mongo'):
        raise RuntimeError('Browser fixtures require local development MongoDB without production credentials.')
    if mongo.hostname == 'fh-mongo': mongo = mongo._replace(netloc='localhost:27017')
    client = pymongo.MongoClient(urlunparse(mongo), serverSelectionTimeoutMS=5000)
    db = client[get('MONGO_DB', 'forgeharbor')]
    users = client['forgeharbor'].users
    store = LocalReportStore()
    try:
        if action == 'init':
            client.admin.command('ping')
            if store.request('HEAD') != 200: raise RuntimeError('Local S3 fixture cleanup access is unavailable.')
        elif action == 'seed':
            for index, email in enumerate(emails):
                user = users.find_one({'email': email})
                if not user: raise RuntimeError('Disposable UI account was not created.')
                if not isinstance(user.get('user_id'), str) or not user['user_id']:
                    raise RuntimeError('Disposable Auth account has no public user identity.')
                document = {'_id': ids[index], 'user_id': user['user_id'], 'scan_type': 'file',
                            'input': config['targets'][index], 'result': {'malicious': True, 'risk_level': 'high', 'vendor_positives': 5, 'total_vendors': 70},
                            'created_at': datetime.now(timezone.utc), 'test_fixture_run_id': run_id}
                db.scans.replace_one({'_id': ids[index]}, document, upsert=True)
                if db.scans.count_documents({'_id': ids[index], 'test_fixture_run_id': run_id}) != 1:
                    raise RuntimeError('Stored scan fixture verification failed.')
        elif action == 'cleanup':
            owner_ids = [user['user_id'] for user in users.find({'email': {'$in': emails}}) if user.get('user_id')]
            report_filter = {'scanId': {'$in': config['scanIds']}, 'user_id': {'$in': owner_ids}}
            if not owner_ids and db.reports.count_documents({'scanId': {'$in': config['scanIds']}}):
                raise RuntimeError('Fixture report owners are unavailable; retain records for scoped recovery.')
            deadline = time.monotonic() + 20
            while db.reports.count_documents({**report_filter, 'notification_pending': True}) and time.monotonic() < deadline:
                time.sleep(0.1)
            if db.reports.count_documents({**report_filter, 'notification_pending': True}):
                raise RuntimeError('Pending fixture outbox work must drain before cleanup; retry cleanup after recovery.')
            reports = list(db.reports.find(report_filter))
            deadline = time.monotonic() + 10
            while db.notifications.count_documents({'report_id': {'$in': [str(item['_id']) for item in reports]}}) < len(reports) and time.monotonic() < deadline:
                time.sleep(0.1)
            if db.notifications.count_documents({'report_id': {'$in': [str(item['_id']) for item in reports]}}) < len(reports):
                raise RuntimeError('Fixture notifications must drain before cleanup; retry after worker recovery.')
            for item in reports:
                if store.request('DELETE', item['key']) not in (200, 204) or store.request('HEAD', item['key']) != 404:
                    raise RuntimeError('Fixture object cleanup failed; users and records were retained for retry.')
            db.reports.delete_many(report_filter)
            db.scans.delete_many({'_id': {'$in': ids}, 'test_fixture_run_id': run_id})
            db.notifications.delete_many({'user': {'$in': owner_ids}})
            redis_delete(get('REDIS_URL', 'redis://localhost:6379'), [account_rate_key(email) for email in emails])
            users.delete_many({'email': {'$in': emails}})
            if db.reports.count_documents(report_filter) or db.scans.count_documents({'test_fixture_run_id': run_id}) or db.notifications.count_documents({'user': {'$in': owner_ids}}) or users.count_documents({'email': {'$in': emails}}):
                raise RuntimeError('Fixture database cleanup verification failed.')
        else:
            raise RuntimeError('Unknown fixture action.')
        print(json.dumps({'runId': run_id, 'action': action, 'verified': True}))
    finally:
        client.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        raise SystemExit(str(exc) if isinstance(exc, RuntimeError) else 'Local browser fixture lifecycle failed.') from None
