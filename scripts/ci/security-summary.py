"""Summarize high/critical findings without exposing secret values or source snippets."""
import json
import sys
from collections import Counter
from pathlib import Path

report = Path(sys.argv[1])
if not report.is_file():
    raise SystemExit("Security scanner produced no report.")
data = json.loads(report.read_text(encoding="utf-8"))
counts = Counter()
vulnerabilities = []
misconfigurations = []

for result in data.get("Results", []):
    target = result.get("Target", "unknown")
    for finding in result.get("Vulnerabilities", []):
        if finding.get("Severity") in ("HIGH", "CRITICAL"):
            identity = finding.get("VulnerabilityID", "unknown")
            counts[("Vulnerabilities", identity, finding["Severity"])] += 1
            vulnerabilities.append({
                "target": target,
                "id": identity,
                "severity": finding["Severity"],
                "package": finding.get("PkgName", "unknown"),
                "installed": finding.get("InstalledVersion", "unknown"),
                "fixed": finding.get("FixedVersion") or "no fixed version listed",
                "title": finding.get("Title", ""),
            })
    for finding in result.get("Secrets", []):
        if finding.get("Severity") in ("HIGH", "CRITICAL"):
            # Do not print paths, match text, or code snippets from secret findings.
            counts[("Secrets", finding.get("RuleID", "unknown"), finding["Severity"])] += 1
    for finding in result.get("Misconfigurations", []):
        if finding.get("Severity") in ("HIGH", "CRITICAL"):
            identity = finding.get("ID", "unknown")
            counts[("Misconfigurations", identity, finding["Severity"])] += 1
            misconfigurations.append({
                "target": target,
                "id": identity,
                "severity": finding["Severity"],
                "resource": finding.get("AffectedResource", "unknown"),
                "title": finding.get("Title", ""),
                "resolution": finding.get("Resolution", ""),
            })

for (category, identity, severity), count in sorted(counts.items()):
    print(f"{category}: {identity} {severity} ({count})")

for finding in sorted(vulnerabilities, key=lambda item: (item["target"], item["package"], item["id"])):
    print(
        "Vulnerability detail: "
        f'{finding["target"]}: {finding["package"]} '
        f'{finding["installed"]} -> {finding["fixed"]}; '
        f'{finding["id"]} {finding["severity"]}'
        + (f' — {finding["title"]}' if finding["title"] else "")
    )

for finding in sorted(misconfigurations, key=lambda item: (item["target"], item["resource"], item["id"])):
    print(
        "Misconfiguration detail: "
        f'{finding["target"]}: {finding["resource"]}; '
        f'{finding["id"]} {finding["severity"]}'
        + (f' — {finding["title"]}' if finding["title"] else "")
        + (f' — {finding["resolution"]}' if finding["resolution"] else "")
    )

if not counts:
    print("No HIGH/CRITICAL findings in the scanner report.")
