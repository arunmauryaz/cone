$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (Test-Path -LiteralPath 'D:\Rust\env.ps1') { . 'D:\Rust\env.ps1' }
Set-Location -LiteralPath $projectRoot
Write-Host 'CONE development shell. Rust manifest: backend/Cargo.toml.'
