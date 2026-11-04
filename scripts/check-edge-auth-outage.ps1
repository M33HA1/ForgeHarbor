$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
$restoreAuth = $false
try {
    if (($env:GATEWAY_URL -and $env:GATEWAY_URL.TrimEnd('/') -ne 'http://localhost:8088') -or
        ($env:TRAEFIK_API_URL -and $env:TRAEFIK_API_URL.TrimEnd('/') -ne 'http://localhost:8000')) {
        throw 'The outage drill supports only the default local gateway and Traefik API.'
    }
    $dockerEndpoint = & docker context inspect --format '{{.Endpoints.docker.Host}}'
    if ($LASTEXITCODE -ne 0 -or $dockerEndpoint -notlike 'npipe://*' -or $env:DOCKER_HOST) {
        throw 'The outage drill requires a local Windows Docker context with no DOCKER_HOST override.'
    }
    $running = & docker compose -f deploy/compose/docker-compose.dev.yml ps --status running --services
    if ($LASTEXITCODE -ne 0 -or $running -notcontains 'fh-auth') {
        throw 'Auth must already be running before this local outage drill.'
    }
    & node scripts/check-edge-auth.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Baseline edge checks failed.' }
    $restoreAuth = $true
    & docker compose -f deploy/compose/docker-compose.dev.yml stop -t 10 fh-auth
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop Auth for the outage drill.' }
    & node scripts/check-edge-auth.mjs --auth-unavailable
    if ($LASTEXITCODE -ne 0) { throw 'Edge outage checks failed.' }
} finally {
    if ($restoreAuth) {
        & docker compose -f deploy/compose/docker-compose.dev.yml up -d fh-auth
        if ($LASTEXITCODE -ne 0) { throw 'Auth restoration failed; start fh-auth immediately.' }
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            & curl.exe -fs -o NUL --max-time 2 http://localhost:8080/auth/health
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
            Start-Sleep -Seconds 1
        }
        if (-not $ready) { throw 'Auth did not become healthy after restoration.' }
        # Allow the Docker provider to register the restored public Auth router.
        & node scripts/check-edge-auth.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Edge recovery checks failed after Auth restoration.' }
    }
    Pop-Location
}
Write-Host 'Auth outage and recovery drill passed.'
