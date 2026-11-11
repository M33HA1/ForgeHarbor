param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectName = 'fh-mfa-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) $projectName
$composeFile = Join-Path $fixtureRoot 'compose.json'
$oldFixture = $env:FH_MFA_FIXTURE
$oldProject = $env:FH_MFA_PROJECT
# Dedicated loopback ports; never replace or stop an existing development stack.
foreach ($port in @(8088, 8180, 8181)) {
    $probe = [Net.Sockets.TcpClient]::new()
    try { $probe.Connect('127.0.0.1', $port); throw "Port $port is occupied; stop its owner before running the isolated MFA suite." }
    catch [Net.Sockets.SocketException] { }
    finally { $probe.Dispose() }
}
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
try {
    $env:FH_MFA_FIXTURE = $fixtureRoot
    $env:FH_MFA_PROJECT = $projectName
    # Generate independent keys. No local config/.env or existing key is read.
    @'
const {generateKeyPairSync,randomBytes}=require('node:crypto');
const {writeFileSync}=require('node:fs');const path=require('node:path');
const root=process.env.FH_MFA_FIXTURE, project=process.env.FH_MFA_PROJECT;
const pair=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
writeFileSync(path.join(root,'jwt-private.pem'),pair.privateKey,{mode:0o600});
writeFileSync(path.join(root,'jwt-public.pem'),pair.publicKey);
writeFileSync(path.join(root,'mfa-encryption.key'),randomBytes(32),{mode:0o600});
const auth={image:project+'-go',command:['auth'],ports:['127.0.0.1:8180:8080'],volumes:[root.replaceAll('\\','/')+':/app/config:ro'],environment:{MONGO_URI:'mongodb://mongo:27017',REDIS_URL:'redis://redis:6379',AUTH_COOKIE_SECURE:'false',CORS_ALLOWED_ORIGINS:'http://localhost:8088'},depends_on:{mongo:{condition:'service_healthy'},redis:{condition:'service_healthy'}}};
const legacy={...auth,image:project+'-rust',ports:['127.0.0.1:8181:8080']};delete legacy.command;
const config={services:{mongo:{image:'mongo:6.0',healthcheck:{test:['CMD','mongosh','--quiet','--eval',"db.adminCommand('ping')"],interval:'2s',timeout:'5s',retries:30}},redis:{image:'redis:7-alpine',healthcheck:{test:['CMD','redis-cli','ping'],interval:'2s',timeout:'5s',retries:30}},auth,legacy,web:{image:project+'-web',ports:['127.0.0.1:8088:3000']}}};
writeFileSync(path.join(root,'compose.json'),JSON.stringify(config));
'@ | node
    if ($LASTEXITCODE -ne 0) { throw 'MFA fixture generation failed.' }
    & docker run --rm --mount "type=bind,source=$fixtureRoot,target=/keys" alpine:3.23 chown 65532:65532 /keys/jwt-private.pem /keys/mfa-encryption.key
    if ($LASTEXITCODE -ne 0) { throw 'MFA fixture key permissions failed.' }
    foreach ($item in @(@('go','apps/controlplane-go'), @('rust','apps/auth-rs'), @('web','apps/web'))) {
        & docker build -t "$projectName-$($item[0])" (Join-Path $projectRoot $item[1])
        if ($LASTEXITCODE -ne 0) { throw "MFA $($item[0]) image failed." }
    }
    & docker compose -p $projectName -f $composeFile up -d --wait --wait-timeout 120
    if ($LASTEXITCODE -ne 0) { throw 'MFA fixture startup failed.' }
    & node (Join-Path $PSScriptRoot 'ci/mfa-browser.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'MFA browser verification failed.' }
} finally {
    if (Test-Path -LiteralPath $composeFile) {
        & docker compose -p $projectName -f $composeFile down --volumes --remove-orphans
    }
    # Verify the exact generated temporary directory before recursive cleanup.
    $resolvedFixture = [IO.Path]::GetFullPath($fixtureRoot)
    $expectedFixture = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) $projectName))
    if ($resolvedFixture -eq $expectedFixture -and (Split-Path $resolvedFixture -Leaf) -match '^fh-mfa-[0-9a-f]{10}$') {
        Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
    }
    $env:FH_MFA_FIXTURE = $oldFixture
    $env:FH_MFA_PROJECT = $oldProject
}
