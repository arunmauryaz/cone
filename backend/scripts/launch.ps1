$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath 'D:\Rust\env.ps1') { . 'D:\Rust\env.ps1' }
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $projectRoot
$manifest = Join-Path $projectRoot 'backend\Cargo.toml'
$dataDirectory = Join-Path $projectRoot 'data'
New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
$env:CONE_LOCAL_ADMIN = 'false'
$setupFile = Join-Path $dataDirectory 'local-setup.json'
if (Test-Path -LiteralPath $setupFile) {
    $setup = Get-Content -LiteralPath $setupFile -Raw | ConvertFrom-Json
    $env:CONE_INITIAL_USERNAME = $setup.initialUsername
    $env:CONE_INITIAL_PASSWORD = $setup.initialPassword
}
if ($env:CONE_INITIAL_USERNAME -and $env:CONE_INITIAL_PASSWORD) { $env:CONE_LOCAL_ADMIN = 'true' }
foreach ($port in @(8000, 5173)) {
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    foreach ($ownerId in @($listeners.OwningProcess | Sort-Object -Unique)) {
        if (-not $ownerId) { continue }
        Write-Host "Restarting CONE: stopping process $ownerId on port $port."
        $ownerProcess = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
        if ($ownerProcess) {
            Stop-Process -InputObject $ownerProcess -Force
            if (-not $ownerProcess.WaitForExit(10000)) {
                throw "Process $ownerId on port $port did not stop."
            }
        }
    }
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port is still occupied. Could not restart CONE."
    }
}
& cargo build --manifest-path $manifest -p cone-backend --locked
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
$metadata = (& cargo metadata --manifest-path $manifest --format-version 1 --no-deps | ConvertFrom-Json)
$binary = Join-Path $metadata.target_directory 'debug\cone-backend.exe'
$logs = Join-Path $dataDirectory 'logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$backendProcess = Start-Process -FilePath $binary -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'backend.log') -RedirectStandardError (Join-Path $logs 'backend-error.log')
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($backendProcess.HasExited) { throw "Backend exited. Check $logs." }
        try { $health = Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 1; $ready = $health.app -eq 'CONE Rust backend'; if ($ready) { break } } catch {}
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Backend did not become ready.' }
    Set-Location -LiteralPath (Join-Path $projectRoot 'frontend')
    if (-not (Test-Path -LiteralPath 'node_modules')) { & npm ci --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' } }
    Write-Host 'CONE: http://localhost:5173 - sign in with your saved account. Ctrl+C stops development.'
    & npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
} finally {
    if (-not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id }
}
