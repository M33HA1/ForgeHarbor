"""Create an ephemeral CI environment; refuse to replace local configuration."""
import os
import secrets
from pathlib import Path

if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('CI environment preparation requires a GitHub-hosted workflow.')
root = Path(__file__).resolve().parents[2]
destination = root / 'config/.env'
if destination.exists():
    raise SystemExit('Refusing to overwrite an existing environment file.')
settings = {
    'GEMINI_API_KEY': 'ci-disabled-no-provider-key',
    'VIRUSTOTAL_API_KEY': 'ci-disabled-no-provider-key',
    'JWT_SECRET': secrets.token_hex(32),
    'S3_ACCESS_KEY': 'minioadmin', 'S3_SECRET_KEY': 'minioadmin',
    'MINIO_ACCESS_KEY': 'minioadmin', 'MINIO_SECRET_KEY': 'minioadmin',
}
lines = []
for line in (root / 'config/.env.example').read_text(encoding='utf-8').splitlines():
    name, separator, _ = line.partition('=')
    lines.append(f'{name}={settings[name]}' if separator and name in settings else line)
with destination.open('x', encoding='utf-8') as output:
    output.write('\n'.join(lines) + '\n')
print('Ephemeral CI settings created; external provider credentials are disabled.')
