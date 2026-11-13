$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'test-resources.ps1')
$script:removed = @()
$script:inventory = @()
$script:failInventory = $false
$script:failRemoval = $false
function docker {
    if ($args[0] -ne 'image') { throw 'Unexpected Docker operation' }
    if ($args[1] -eq 'ls') {
        $global:LASTEXITCODE = [int]$script:failInventory
        return $script:inventory
    }
    if ($args[1] -ne 'rm' -or $args.Count -ne 3 -or $args -contains '--force') { throw 'Unsafe image removal' }
    $script:removed += $args[2]
    $global:LASTEXITCODE = [int]$script:failRemoval
}
function Assert-Throws([scriptblock]$Action) {
    $threw = $false
    try { & $Action } catch { $threw = $true }
    if (!$threw) { throw 'Expected cleanup to fail closed' }
}
$mfa = 'fh-mfa-0123456789'
$parity = 'fh-go-parity-0123456789'
$script:inventory = @("$mfa-go:latest", "$mfa-rust:latest", "$mfa-web:latest", 'compose-fh-auth:latest', 'mongo:6.0', 'fh-mfa-aaaaaaaaaa-go:latest', "$mfa-other:latest")
Remove-ForgeHarborTestImages -ProjectName $mfa
if (($script:removed -join ',') -ne "$mfa-go:latest,$mfa-rust:latest,$mfa-web:latest") { throw 'Cleanup escaped the MFA image allowlist' }
$script:removed = @()
$script:inventory = @("$parity-contracts:latest", 'rabbitmq:3-management')
Remove-ForgeHarborTestImages -ProjectName $parity
if (($script:removed -join ',') -ne "$parity-contracts:latest") { throw 'Cleanup escaped the parity image allowlist' }
Assert-Throws { Remove-ForgeHarborTestImages -ProjectName 'compose' }
Assert-Throws { Remove-ForgeHarborTestImages -ProjectName 'fh-mfa-invalid' }
$script:removed = @()
$script:inventory = @()
Remove-ForgeHarborTestImages -ProjectName $mfa
if ($script:removed.Count -ne 0) { throw 'Cleanup removed a missing image' }
$script:failInventory = $true
Assert-Throws { Remove-ForgeHarborTestImages -ProjectName $mfa }
if ($script:removed.Count -ne 0) { throw 'Cleanup continued after inventory failure' }
$script:failInventory = $false
$script:failRemoval = $true
$script:inventory = @("$mfa-go:latest")
Assert-Throws { Remove-ForgeHarborTestImages -ProjectName $mfa }
Write-Output 'Fixture image cleanup: allowlists, missing images, invalid projects and Docker failures passed.'
$global:LASTEXITCODE = 0
