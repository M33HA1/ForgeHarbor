param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'ci/test-resources.ps1')
& (Join-Path $PSScriptRoot 'ci/test-resources.test.ps1')
$composeFile = Join-Path $projectRoot 'deploy/compose/docker-compose.go-parity.yml'
$projectName = 'fh-go-parity-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$originalPassword = $env:FH_PARITY_RABBIT_PASSWORD
try {
    $env:FH_PARITY_RABBIT_PASSWORD = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    & docker compose -p $projectName -f $composeFile up --build --attach contracts --abort-on-container-exit --exit-code-from contracts
    $testExit = $LASTEXITCODE
    if ($testExit -ne 0) { throw "Go parity suite failed (exit $testExit)." }
} finally {
    try {
        & docker compose -p $projectName -f $composeFile down --volumes --remove-orphans
        if ($LASTEXITCODE -ne 0) { throw 'Go parity fixture teardown failed.' }
        Remove-ForgeHarborTestImages -ProjectName $projectName
    } finally {
        $env:FH_PARITY_RABBIT_PASSWORD = $originalPassword
    }
}
