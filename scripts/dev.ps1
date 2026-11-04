[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('build', 'up', 'down', 'status', 'health', 'logs', 'test', 'config', 'mcp', 'help')]
  [string]$Command = 'help',

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $Root 'deploy/compose/docker-compose.dev.yml'
$EnvFile = Join-Path $Root 'config/.env'

function Write-Usage {
  @'
ForgeHarbor development helper

Usage:
  .\scripts\dev.ps1 <command> [args]

Commands:
  build    Build every service image
  up       Start the stack in the background (add --build on first run)
  down     Stop containers, keep volumes
  status   Show branch, commit, containers, health, and MCP state
  health   Probe the gateway and every service; exit 1 if any probe fails
  logs     Follow logs; pass a service name to narrow, e.g. logs fh-auth
  test     Validate Compose, vault, shell, Python, and gateway routes
  config   Validate the Compose file without starting anything
  mcp      Show MCP server connection state
  help     Show this message

The gateway is http://localhost:8088. The Traefik dashboard is http://localhost:8000.
'@ | Write-Host
}

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error 'docker was not found on PATH. Install Docker Desktop and reopen the terminal.'
    exit 1
  }
}

function Assert-EnvFile {
  if (-not (Test-Path -LiteralPath $EnvFile)) {
    Write-Warning "config/.env is missing. Copy config/.env.example to config/.env and fill in placeholders before starting."
  }
}

function Invoke-Compose {
  param([string[]]$ComposeArgs)
  & docker compose -f $ComposeFile @ComposeArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

switch ($Command) {
  'help' {
    Write-Usage
  }

  'build' {
    Assert-Docker
    Assert-EnvFile
    $composeArgs = @('build')
    if ($Rest) { $composeArgs += $Rest }
    Invoke-Compose $composeArgs
  }

  'up' {
    Assert-Docker
    Assert-EnvFile
    $composeArgs = @('up', '-d')
    if ($Rest) { $composeArgs += $Rest }
    Invoke-Compose $composeArgs
    Write-Host 'Stack start requested. Run .\scripts\dev.ps1 status, then .\scripts\dev.ps1 health.'
  }

  'down' {
    Assert-Docker
    $composeArgs = @('down')
    if ($Rest) { $composeArgs += $Rest }
    Invoke-Compose $composeArgs
  }

  'status' {
    if ($Rest) {
      & (Join-Path $PSScriptRoot 'status.ps1') @Rest
    } else {
      & (Join-Path $PSScriptRoot 'status.ps1')
    }
    if (-not $?) { exit 1 }
    exit 0
  }

  'health' {
    if ($Rest) {
      & (Join-Path $PSScriptRoot 'status.ps1') -HealthOnly @Rest
    } else {
      & (Join-Path $PSScriptRoot 'status.ps1') -HealthOnly
    }
    if (-not $?) { exit 1 }
    exit 0
  }

  'logs' {
    Assert-Docker
    $composeArgs = @('logs', '-f')
    if ($Rest) { $composeArgs += $Rest }
    Invoke-Compose $composeArgs
  }

  'config' {
    Assert-Docker
    Invoke-Compose @('config', '--quiet')
    Write-Host 'Compose configuration is valid.'
  }

  'mcp' {
    if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
      Write-Error 'codex was not found on PATH; open this trusted repository in Codex to inspect project MCP servers.'
      exit 1
    }
    & codex mcp list
    exit $LASTEXITCODE
  }

  'test' {
    $failed = $false
    Assert-Docker

    Write-Host '==> Compose configuration'
    & docker compose -f $ComposeFile config --quiet
    if ($LASTEXITCODE -ne 0) { $failed = $true }

    Write-Host '==> Vault JSON and Canvas files'
    $jsonFiles = @()
    $jsonFiles += Get-ChildItem -Path (Join-Path $Root 'docs/obsidian/.obsidian') -Filter '*.json' -File -ErrorAction SilentlyContinue
    $jsonFiles += Get-ChildItem -Path (Join-Path $Root 'docs/obsidian/Canvas') -Filter '*.canvas' -File -ErrorAction SilentlyContinue
    foreach ($file in $jsonFiles) {
      try {
        Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json | Out-Null
        Write-Host "  ok  $($file.Name)"
      } catch {
        Write-Host "  bad $($file.Name): $($_.Exception.Message)"
        $failed = $true
      }
    }

    Write-Host '==> Vault wikilinks'
    if (Get-Command node -ErrorAction SilentlyContinue) {
      & node (Join-Path $Root 'scripts/check-links.mjs')
      if ($LASTEXITCODE -ne 0) { $failed = $true }
    } else {
      Write-Host '  skipped: node not found'
    }

    Write-Host '==> Shell script syntax'
    $gitBash = 'C:\Program Files\Git\bin\bash.exe'
    if (Test-Path -LiteralPath $gitBash) {
      Push-Location $Root
      try {
        foreach ($script in @('scripts/dev.sh', 'scripts/status.sh', 'scripts/ci/integration.sh')) {
          if (Test-Path -LiteralPath (Join-Path $Root $script)) {
            & $gitBash -n $script
            if ($LASTEXITCODE -ne 0) {
              Write-Host "  bad $script"
              $failed = $true
            } else {
              Write-Host "  ok  $script"
            }
          }
        }
      } finally {
        Pop-Location
      }
    } else {
      Write-Host '  skipped: Git Bash not found'
    }

    Write-Host '==> Python syntax'
    if (Get-Command python -ErrorAction SilentlyContinue) {
      Push-Location (Join-Path $Root 'apps/notify-py')
      try {
        & python -m compileall -q .
        if ($LASTEXITCODE -ne 0) { $failed = $true }
      } finally {
        Pop-Location
      }
      & python -c 'import pathlib,sys; [compile(pathlib.Path(p).read_text(encoding="utf-8"),p,"exec") for p in sys.argv[1:]]' (Join-Path $Root 'scripts/check-auth-inputs.py') (Join-Path $Root 'scripts/ci/prepare.py') (Join-Path $Root 'scripts/ci/security-summary.py')
      if ($LASTEXITCODE -ne 0) { $failed = $true }
    } else {
      Write-Host '  skipped: python not found'
    }

    Write-Host '==> Gateway route contract'
    if (Get-Command node -ErrorAction SilentlyContinue) {
      & node (Join-Path $Root 'scripts/check-routes.mjs')
      if ($LASTEXITCODE -ne 0) { $failed = $true }
      & node (Join-Path $Root 'scripts/check-cors.mjs')
      if ($LASTEXITCODE -ne 0) { $failed = $true }
    } else {
      Write-Host '  skipped: node not found'
    }

    Write-Host '==> Known application blockers (tracked, not fixed here)'
    Write-Host '  security: production TLS/exposure, proxy trust, and provider configuration remain open'

    if ($failed) {
      Write-Error 'Tooling verification failed.'
      exit 1
    }
    Write-Host 'Tooling verification passed.'
  }
}
