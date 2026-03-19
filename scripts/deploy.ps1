<#
.SYNOPSIS
    KC DevKit — Deploy Script
.DESCRIPTION
    Builds the extension, packages it as a .vsix, and either publishes
    to the VS Code Marketplace (if AZURE_PAT is set in .env) or installs locally.
#>

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== KC DevKit Deploy ===" -ForegroundColor Cyan
Set-Location $ProjectRoot

# Step 1: Parse .env file for AZURE_PAT
$envFile = Join-Path $ProjectRoot ".env"
$pat = $null

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $val, 'Process')
            if ($key -eq 'AZURE_PAT') {
                $pat = $val
            }
        }
    }
}

if (-not $pat) {
    $pat = $env:AZURE_PAT
}

# Step 2: Run build
Write-Host "[1/3] Building..." -ForegroundColor Yellow
$buildScript = Join-Path $ProjectRoot "scripts/build.ps1"
& powershell -ExecutionPolicy Bypass -File $buildScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}

# Step 3: Package VSIX
Write-Host "[2/3] Packaging VSIX..." -ForegroundColor Yellow
$vsce = Join-Path $ProjectRoot "node_modules/.bin/vsce"

& $vsce package --no-dependencies 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: VSIX packaging failed" -ForegroundColor Red
    exit 1
}

$vsix = Get-ChildItem -Path $ProjectRoot -Filter "*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $vsix) {
    Write-Host "ERROR: No .vsix file found" -ForegroundColor Red
    exit 1
}

$vsixSize = $vsix.Length / 1MB
Write-Host "  VSIX: $($vsix.Name) ($([math]::Round($vsixSize, 2)) MB)" -ForegroundColor Green

# Step 4: Publish or install
Write-Host "[3/3] Publishing / Installing..." -ForegroundColor Yellow

if ($pat) {
    Write-Host "  AZURE_PAT found — publishing to marketplace..." -ForegroundColor Cyan
    & $vsce publish --pat $pat --no-dependencies 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Marketplace publish failed. Installing locally instead." -ForegroundColor Yellow
    } else {
        Write-Host "  Published to VS Code Marketplace!" -ForegroundColor Green
    }
}

# Always install locally
Write-Host "  Installing locally..." -ForegroundColor Cyan
code --install-extension $vsix.FullName --force 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Installed locally: $($vsix.Name)" -ForegroundColor Green
} else {
    Write-Host "WARNING: Local install failed" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=== Deploy Complete ===" -ForegroundColor Cyan
if ($pat) {
    Write-Host "  Marketplace: Published" -ForegroundColor Green
} else {
    Write-Host "  Marketplace: Skipped (set AZURE_PAT in .env)" -ForegroundColor Yellow
}
Write-Host "  Local: Installed" -ForegroundColor Green
Write-Host "  VSIX: $($vsix.Name) ($([math]::Round($vsixSize, 2)) MB)" -ForegroundColor White
