"""Summarize scanner IDs/counts without printing secret matches or source."""
import json
import sys
from collections import Counter
from pathlib import Path

report = Path(sys.argv[1])
if not report.is_file():
    raise SystemExit('Security scanner produced no report.')
data = json.loads(report.read_text(encoding='utf-8'))
counts = Counter()
for result in data.get('Results', []):
    for category, identity in [('Vulnerabilities', 'VulnerabilityID'), ('Secrets', 'RuleID'), ('Misconfigurations', 'ID')]:
        for finding in result.get(category, []):
            if finding.get('Severity') in ('HIGH', 'CRITICAL'):
                counts[(category, finding.get(identity, 'unknown'), finding['Severity'])] += 1
for (category, identity, severity), count in sorted(counts.items()):
    print(f'{category}: {identity} {severity} ({count})')
if not counts:
    print('No HIGH/CRITICAL findings in the scanner report.')
