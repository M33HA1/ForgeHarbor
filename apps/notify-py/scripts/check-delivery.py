"""Exercise a real local broker/Mongo worker on unique disposable queues."""
import json
import os
import sys
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pika
import pymongo
from bson import ObjectId
from dotenv import dotenv_values
from pymongo.errors import AutoReconnect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worker import consume_forever, declare_queues


def main():
    root = Path(__file__).resolve().parents[3]
    values = dotenv_values(root / 'config/.env')
    get = lambda key, default: os.environ.get(key) or values.get(key) or default
    mongo = urlparse(get('MONGO_URI', 'mongodb://localhost:27017'))
    if mongo.hostname == 'fh-mongo':
        mongo = mongo._replace(netloc=mongo.netloc.replace('fh-mongo', 'localhost', 1))
    broker = urlparse(get('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672/'))
    if broker.hostname == 'fh-rabbit':
        broker = broker._replace(netloc=broker.netloc.replace('fh-rabbit', 'localhost', 1))
    if broker.hostname not in ('localhost', '127.0.0.1') or mongo.hostname not in ('localhost', '127.0.0.1'):
        raise RuntimeError('Delivery fixture requires local test infrastructure.')
    run_id = uuid.uuid4().hex
    queue, owner = 'notify-check-' + run_id, 'notify-check-' + run_id
    client = pymongo.MongoClient(urlunparse(mongo), serverSelectionTimeoutMS=2000)
    collection = client[get('MONGO_DB', 'forgeharbor')].notifications
    params = pika.URLParameters(urlunparse(broker))
    params.socket_timeout = 5
    params.blocked_connection_timeout = 5
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    stop, thread = threading.Event(), None
    report_ids = [str(ObjectId()) for _ in range(4)]

    def event(index):
        return {'schema_version': 1, 'event_id': 'report.created:' + report_ids[index], 'event_type': 'report.created',
                'user_id': owner, 'occurred_at': '2026-11-03T00:00:00Z',
                'data': {'report_id': report_ids[index], 'scan_id': str(ObjectId()), 'message': 'Report created'}}

    class Faults:
        # Inject storage errors at the worker boundary while using real broker
        # delivery/confirmation/TTL and real MongoDB persistence for successes.
        attempts = {}
        def update_one(self, query, update, upsert=False):
            identity = query['_id']
            count = self.attempts.get(identity, 0)
            self.attempts[identity] = count + 1
            if identity.endswith(report_ids[2]) or (identity.endswith(report_ids[1]) and count < 2):
                raise AutoReconnect('injected local fixture failure')
            return collection.update_one(query, update, upsert=upsert)
        def find_one(self, query): return collection.find_one(query)

    def wait_for(predicate, message, timeout=15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate(): return
            connection.process_data_events(time_limit=0.1)
            time.sleep(0.05)
        raise RuntimeError(message)

    def publish(body):
        channel.basic_publish('', queue, json.dumps(body).encode() if not isinstance(body, bytes) else body,
                              mandatory=True, properties=pika.BasicProperties(delivery_mode=2))

    try:
        declare_queues(channel, queue, retry_ms=200)
        channel.confirm_delivery()
        faults = Faults()
        thread = threading.Thread(target=consume_forever, args=(urlunparse(broker), queue, faults, stop, 200), daemon=True)
        thread.start()
        wait_for(lambda: channel.queue_declare(queue=queue, passive=True).method.consumer_count == 1, 'Fixture worker did not connect.')
        first = event(0)
        publish(first)
        publish(first)
        collision = {**first, 'user_id': owner + '-other'}
        publish(collision)
        publish(b'{')
        publish(event(1))
        publish(event(2))
        legacy = {'reportId': report_ids[3], 'scanId': str(ObjectId()), 'user': owner, 'message': 'Report created'}
        publish(legacy)
        publish(legacy)
        wait_for(lambda: collection.count_documents({'user': owner}) == 3, 'Successful/retried/legacy events were not persisted exactly once.')
        wait_for(lambda: channel.queue_declare(queue=queue + '.dead', passive=True).method.message_count == 3, 'Poison/collision/exhausted retry events did not reach dead queue.')
        dead = []
        for _ in range(3):
            method, properties, body = channel.basic_get(queue + '.dead', auto_ack=False)
            dead.append((properties.headers, body))
            channel.basic_ack(method.delivery_tag)
        if sum(headers.get('x-notify-reason') == 'invalid_event' for headers, _ in dead) != 2:
            raise RuntimeError('Malformed/colliding events were not dead-lettered.')
        if not any(headers.get('x-notify-reason') == 'storage_retries_exhausted' and headers.get('x-notify-attempt') == 4 for headers, _ in dead):
            raise RuntimeError('Storage retries were not bounded to three retries.')
        if faults.attempts.get('event:report.created:' + report_ids[1]) != 3:
            raise RuntimeError('Transient storage event did not succeed on its third attempt.')
        if collection.count_documents({'user': owner + '-other'}):
            raise RuntimeError('An identity collision changed notification ownership.')
    finally:
        stop.set()
        if thread:
            thread.join(timeout=10)
            if thread.is_alive(): raise RuntimeError('Fixture worker did not stop.')
        for name in [queue, queue + '.retry', queue + '.dead']:
            channel.queue_delete(name)
        connection.close()
        collection.delete_many({'user': {'$in': [owner, owner + '-other']}})
        if collection.count_documents({'user': owner}): raise RuntimeError('Fixture cleanup failed.')
        client.close()
    print('Delivery integration passed (duplicate/legacy idempotency, poison/collision dead-lettering, transient retries, exhausted retries, cleanup).')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        raise SystemExit('Delivery integration failed: ' + (str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__)) from None
