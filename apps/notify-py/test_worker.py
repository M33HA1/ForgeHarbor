import json
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import pika
from pymongo.errors import AutoReconnect
from worker import InvalidEvent, callback_for, consume_forever, notification


def event():
    return {"schema_version": 1, "event_id": "report.created:" + "a" * 24,
            "event_type": "report.created", "user_id": "owner",
            "occurred_at": "2026-11-03T00:00:00Z",
            "data": {"report_id": "a" * 24, "scan_id": "b" * 24, "message": "Report created"}}


class Collection:
    def __init__(self):
        self.documents = {}

    def update_one(self, query, update, upsert=False):
        self.documents.setdefault(query["_id"], update["$setOnInsert"])

    def find_one(self, query):
        return self.documents.get(query["_id"])


class Channel:
    def __init__(self):
        self.operations = []

    def basic_publish(self, **kwargs):
        self.operations.append(("publish", kwargs))

    def basic_ack(self, **kwargs):
        self.operations.append(("ack", kwargs))


class WorkerTests(unittest.TestCase):
    def test_duplicate_event_is_idempotent_and_identity_collision_is_dead_lettered(self):
        collection, channel = Collection(), Channel()
        callback = callback_for(collection, "test")
        args = (channel, SimpleNamespace(delivery_tag=1), pika.BasicProperties())
        callback(*args, json.dumps(event()).encode())
        callback(*args, json.dumps(event()).encode())
        self.assertEqual(len(collection.documents), 1)
        changed = event()
        changed["user_id"] = "other-owner"
        callback(*args, json.dumps(changed).encode())
        self.assertEqual(channel.operations[-2][1]["routing_key"], "test.dead")
        self.assertEqual(next(iter(collection.documents.values()))["user"], "owner")

    def test_poison_is_published_before_original_is_acknowledged(self):
        channel = Channel()
        callback_for(Collection(), "test")(channel, SimpleNamespace(delivery_tag=1), pika.BasicProperties(), b'{')
        self.assertEqual([op[0] for op in channel.operations], ["publish", "ack"])
        self.assertTrue(channel.operations[0][1]["mandatory"])
        self.assertEqual(channel.operations[0][1]["properties"].delivery_mode, 2)

    def test_failed_handoff_never_acknowledges_original(self):
        channel = Channel()
        channel.basic_publish = lambda **kwargs: (_ for _ in ()).throw(pika.exceptions.AMQPConnectionError())
        with self.assertRaises(pika.exceptions.AMQPConnectionError):
            callback_for(Collection(), "test")(channel, SimpleNamespace(delivery_tag=1), pika.BasicProperties(), b'{')
        self.assertEqual(channel.operations, [])

    def test_storage_retries_are_bounded(self):
        collection = Collection()
        collection.update_one = lambda *args, **kwargs: (_ for _ in ()).throw(AutoReconnect())
        for attempt, expected in [(0, "test.retry"), (3, "test.dead")]:
            channel = Channel()
            callback_for(collection, "test")(channel, SimpleNamespace(delivery_tag=1), pika.BasicProperties(headers={"x-notify-attempt": attempt}), json.dumps(event()).encode())
            self.assertEqual(channel.operations[0][1]["routing_key"], expected)

    def test_invalid_contracts_are_rejected_and_legacy_identity_is_stable(self):
        for body in [b'[]', b'{}', b'null', b'x' * 65537]:
            with self.assertRaises(InvalidEvent):
                notification(body)
        legacy = json.dumps({"reportId": "a" * 24, "scanId": "b" * 24, "user": "owner", "message": "Report created"}).encode()
        self.assertEqual(notification(legacy), notification(legacy))

    def test_connection_failure_reconnects_until_stop(self):
        stop = threading.Event()
        class Stop:
            waits = 0
            def is_set(self): return stop.is_set()
            def wait(self, delay):
                self.waits += 1
                if self.waits == 2: stop.set()
        with patch('worker.pika.BlockingConnection', side_effect=pika.exceptions.AMQPConnectionError()) as connect:
            consume_forever('amqp://guest:guest@localhost:5672/', 'test', Collection(), stop=Stop())
        self.assertEqual(connect.call_count, 2)


if __name__ == '__main__':
    unittest.main()
