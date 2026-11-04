"""Bounded notification delivery with confirmed retry/dead-letter handoff."""
import json
import logging
import re
import threading
from datetime import datetime, timezone

import pika
from bson import ObjectId
from pymongo.errors import PyMongoError

log = logging.getLogger(__name__)
connected = threading.Event()


class InvalidEvent(ValueError):
    pass


def notification(body):
    if len(body) > 65536:
        raise InvalidEvent("event too large")
    try:
        data = json.loads(body)
    except (ValueError, UnicodeError) as exc:
        raise InvalidEvent("invalid JSON") from exc
    if not isinstance(data, dict):
        raise InvalidEvent("event must be an object")
    if "schema_version" not in data:
        # Rolling compatibility with the previous Reports producer. Stable
        # identity/time make redelivery deterministic for these older messages.
        report_id = data.get("reportId")
        if not isinstance(report_id, str) or not re.fullmatch(r"[0-9a-f]{24}", report_id):
            raise InvalidEvent("invalid legacy report ID")
        data = {"schema_version": 1, "event_id": "report.created:" + report_id,
                "event_type": "report.created", "user_id": data.get("user"),
                "occurred_at": ObjectId(report_id).generation_time.isoformat(),
                "data": {"report_id": report_id, "scan_id": data.get("scanId"), "message": data.get("message")}}
    payload = data.get("data")
    if type(data.get("schema_version")) is not int or data["schema_version"] != 1 or data.get("event_type") != "report.created" or not isinstance(payload, dict):
        raise InvalidEvent("unsupported event contract")
    event_id, user = data.get("event_id"), data.get("user_id")
    if not all(isinstance(value, str) and value.strip() and len(value) <= 256 for value in [event_id, user]):
        raise InvalidEvent("invalid event identity")
    report_id, scan_id, message = payload.get("report_id"), payload.get("scan_id"), payload.get("message")
    if not isinstance(report_id, str) or not re.fullmatch(r"[0-9a-f]{24}", report_id):
        raise InvalidEvent("invalid report ID")
    if event_id != "report.created:" + report_id:
        raise InvalidEvent("event identity does not match report")
    if not isinstance(scan_id, str) or not scan_id.strip() or len(scan_id) > 128:
        raise InvalidEvent("invalid scan ID")
    if not isinstance(message, str) or not message.strip() or len(message) > 2000:
        raise InvalidEvent("invalid message")
    try:
        timestamp = datetime.fromisoformat(data["occurred_at"].replace("Z", "+00:00"))
        if timestamp.tzinfo is None:
            raise ValueError("timezone required")
    except (KeyError, AttributeError, TypeError, ValueError) as exc:
        raise InvalidEvent("invalid event time") from exc
    return {"_id": "event:" + event_id, "event_id": event_id, "event_type": "report.created",
            "user": user, "report_id": report_id, "scan_id": scan_id, "message": message,
            "timestamp": timestamp.astimezone(timezone.utc).isoformat()}


def declare_queues(channel, queue, retry_ms=5000):
    channel.queue_declare(queue=queue, durable=True)
    channel.queue_declare(queue=queue + ".dead", durable=True)
    channel.queue_declare(queue=queue + ".retry", durable=True, arguments={
        "x-message-ttl": retry_ms, "x-dead-letter-exchange": "", "x-dead-letter-routing-key": queue})


def callback_for(collection, queue):
    def callback(channel, method, properties, body):
        reason = None
        try:
            document = notification(body)
            collection.update_one({"_id": document["_id"]}, {"$setOnInsert": document}, upsert=True)
            if collection.find_one({"_id": document["_id"]}) != document:
                raise InvalidEvent("event identity collision")
        except InvalidEvent:
            destination, reason = queue + ".dead", "invalid_event"
        except PyMongoError:
            headers = properties.headers or {}
            attempt = headers.get("x-notify-attempt", 0)
            if type(attempt) is not int or attempt < 0 or attempt >= 3:
                destination, reason = queue + ".dead", "storage_retries_exhausted"
            else:
                destination, reason = queue + ".retry", "storage_retry"
        except Exception:
            destination, reason = queue + ".dead", "processing_error"
        if reason:
            headers = dict(properties.headers or {})
            attempt = headers.get("x-notify-attempt", 0)
            headers["x-notify-attempt"] = attempt + 1 if type(attempt) is int else 4
            headers["x-notify-reason"] = reason
            # Publisher confirms and mandatory routing are enabled by the worker.
            # A failed handoff raises, closing the connection without ACKing the
            # original delivery, so the broker can redeliver it after reconnect.
            channel.basic_publish(exchange="", routing_key=destination, body=body, mandatory=True,
                                  properties=pika.BasicProperties(content_type="application/json", delivery_mode=2,
                                                                  message_id=properties.message_id, headers=headers))
            log.warning("Notification delivery routed: %s", reason)
        channel.basic_ack(delivery_tag=method.delivery_tag)
    return callback


def consume_forever(url, queue, collection, stop=None, retry_ms=5000):
    stop = stop or threading.Event()
    delay = 1
    while not stop.is_set():
        connection = None
        try:
            params = pika.URLParameters(url)
            params.heartbeat = 30
            params.blocked_connection_timeout = 10
            params.socket_timeout = 5
            params.connection_attempts = 1
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            declare_queues(channel, queue, retry_ms)
            channel.confirm_delivery()
            channel.basic_qos(prefetch_count=10)
            channel.basic_consume(queue=queue, on_message_callback=callback_for(collection, queue), auto_ack=False)
            connected.set()
            delay = 1
            while not stop.is_set():
                connection.process_data_events(time_limit=1)
        except Exception as exc:
            # Exception text may contain credentials, connection URLs or payloads.
            log.error("Notification worker reconnecting after %s", type(exc).__name__)
        finally:
            connected.clear()
            if connection is not None and connection.is_open:
                try:
                    connection.close()
                except Exception:
                    pass
        if not stop.is_set():
            stop.wait(delay)
            delay = min(delay * 2, 30)
