"""S3 cleanup for local development fixtures, without importing live credentials."""
import hashlib
import hmac
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from urllib.parse import quote, urlparse, urlunparse


class LocalReportStore:
    def __init__(self):
        self.endpoint = urlparse(os.environ.get("REPORT_TEST_S3_ENDPOINT", "http://localhost:9000"))
        if self.endpoint.hostname == "fh-minio":
            self.endpoint = self.endpoint._replace(netloc="localhost:9000")
        if self.endpoint.hostname not in ("localhost", "127.0.0.1"):
            raise RuntimeError("Storage fixtures require local test infrastructure.")
        self.bucket = os.environ.get("REPORT_TEST_S3_BUCKET", "forgeharbor-reports")
        self.region = os.environ.get("REPORT_TEST_S3_REGION", "us-east-1")
        self.access = os.environ.get("REPORT_TEST_S3_ACCESS_KEY", "minioadmin")
        self.secret = os.environ.get("REPORT_TEST_S3_SECRET_KEY", "minioadmin")

    def request(self, method, object_key=""):
        path = "/" + quote(self.bucket, safe="") + ("/" + quote(object_key, safe="/") if object_key else "")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        date = stamp[:8]
        empty_hash = hashlib.sha256(b"").hexdigest()
        signed = "host;x-amz-content-sha256;x-amz-date"
        headers = f"host:{self.endpoint.netloc}\nx-amz-content-sha256:{empty_hash}\nx-amz-date:{stamp}\n"
        canonical = f"{method}\n{path}\n\n{headers}\n{signed}\n{empty_hash}"
        scope = f"{date}/{self.region}/s3/aws4_request"
        string_to_sign = f"AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"
        signing = ("AWS4" + self.secret).encode()
        for part in (date, self.region, "s3", "aws4_request"):
            signing = hmac.new(signing, part.encode(), hashlib.sha256).digest()
        signature = hmac.new(signing, string_to_sign.encode(), hashlib.sha256).hexdigest()
        req = urllib.request.Request(urlunparse(self.endpoint._replace(path=path)), method=method, headers={
            "X-Amz-Date": stamp, "X-Amz-Content-Sha256": empty_hash,
            "Authorization": f"AWS4-HMAC-SHA256 Credential={self.access}/{scope}, SignedHeaders={signed}, Signature={signature}",
        })
        try:
            response = urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            response.read()
            return response.status
