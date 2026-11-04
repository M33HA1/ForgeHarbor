[CmdletBinding()]
param(
  [switch]$HealthOnly,
  [switch]$NoMcp
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $Root 'deploy/compose/docker-compose.dev.yml'

function Test-Endpoint {
  param([string]$Url)
  try {
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
      $statusText = & curl.exe --silent --show-error --output NUL --write-out '%{http_code}' --max-time 3 $Url 2>$null
      if ($LASTEXITCODE -ne 0) {
        return [pscustomobject]@{ Ok = $false; Detail = 'unreachable' }
      }
      $code = [int]$statusText
    } else {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      $code = [int]$response.StatusCode
    }
    return [pscustomobject]@{ Ok = ($code -ge 200 -and $code -lt 400); Detail = "HTTP $code" }
  } catch {
    $code = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $code = [int]$_.Exception.Response.StatusCode
    }
    if ($code) {
      return [pscustomobject]@{ Ok = $false; Detail = "HTTP $code" }
    }
    return [pscustomobject]@{ Ok = $false; Detail = 'unreachable' }
  }
}

function Write-Health {
  $targets = @(
    [pscustomobject]@{ Name = 'gateway'; Url = 'http://localhost:8088/auth/health' },
    [pscustomobject]@{ Name = 'auth'; Url = 'http://localhost:8080/auth/health' },
    [pscustomobject]@{ Name = 'phishing'; Url = 'http://localhost:8081/phishing/health' },
    [pscustomobject]@{ Name = 'malware'; Url = 'http://localhost:8082/malware/health' },
    [pscustomobject]@{ Name = 'history'; Url = 'http://localhost:8083/history/health' },
    [pscustomobject]@{ Name = 'reports'; Url = 'http://localhost:8084/reports/health' },
    [pscustomobject]@{ Name = 'notify'; Url = 'http://localhost:8085/notify/health' },
    [pscustomobject]@{ Name = 'web'; Url = 'http://localhost:3000/' }
  )

  Write-Host ''
  Write-Host 'Health'
  $failures = 0
  foreach ($target in $targets) {
    $result = Test-Endpoint -Url $target.Url
    if (-not $result.Ok) { $failures++ }
    $state = if ($result.Ok) { 'UP' } else { 'DOWN' }
    Write-Host ("  {0,-9} {1,-42} {2,-6} {3}" -f $target.Name, $target.Url, $state, $result.Detail)
  }
  return $failures
}

if ($HealthOnly) {
  $failures = Write-Health
  if ($failures -gt 0) { exit 1 }
  exit 0
}

Write-Host 'ForgeHarbor status'
Write-Host ''

Push-Location $Root
try {
  $branch = (git branch --show-current 2>$null)
  $commit = (git log -1 --format='%h %s' 2>$null)
  $dirty = @(git status --porcelain 2>$null).Count
  Write-Host "  Branch:        $(if ($branch) { $branch } else { 'unknown' })"
  Write-Host "  Commit:        $(if ($commit) { $commit } else { 'unknown' })"
  Write-Host "  Working tree:  $dirty changed path(s)"
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Containers'
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $composeOutput = & docker compose -f $ComposeFile ps 2>&1
  if ($LASTEXITCODE -eq 0) {
    $composeOutput | ForEach-Object { Write-Host "  $_" }
  } else {
    Write-Host '  docker compose ps failed:'
    $composeOutput | ForEach-Object { Write-Host "  $_" }
  }
} else {
  Write-Host '  docker not found on PATH'
}

Write-Health | Out-Null

if (-not $NoMcp) {
  Write-Host ''
  Write-Host 'MCP'
  if (Get-Command codex -ErrorAction SilentlyContinue) {
    $mcpOutput = & codex mcp list 2>&1
    if ($LASTEXITCODE -eq 0) {
      $mcpOutput | ForEach-Object { Write-Host "  $_" }
    } else {
      Write-Host '  codex mcp list failed:'
      $mcpOutput | ForEach-Object { Write-Host "  $_" }
    }
  } else {
    Write-Host '  codex not found on PATH; project MCP state is unverified'
  }
}

Write-Host ''
Write-Host 'Use .\scripts\dev.ps1 health for an exit code that fails on DOWN services.'
exit 0
