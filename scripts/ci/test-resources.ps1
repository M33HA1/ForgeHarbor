# Remove only images created by one isolated test run. Never prune Docker globally.
function Remove-ForgeHarborTestImages {
    param([Parameter(Mandatory)][string]$ProjectName)
    if ($ProjectName -match '^fh-mfa-[0-9a-f]{10}$') {
        $suffixes = @('go', 'rust', 'web')
    } elseif ($ProjectName -match '^fh-go-parity-[0-9a-f]{10}$') {
        $suffixes = @('contracts')
    } else {
        throw 'Refusing image cleanup for a non-fixture project.'
    }
    $existing = @(& docker image ls --format '{{.Repository}}:{{.Tag}}' --filter "reference=$ProjectName-*")
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inventory fixture images; no images removed.' }
    foreach ($suffix in $suffixes) {
        $image = "$ProjectName-${suffix}:latest"
        if ($existing -contains $image) {
            # Preserve Docker's in-use protection; never force image removal.
            & docker image rm $image | Out-Host
            if ($LASTEXITCODE -ne 0) { throw "Fixture image cleanup failed: $image" }
        }
    }
}
