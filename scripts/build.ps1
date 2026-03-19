<#
.SYNOPSIS
    KC DevKit — Build Script
.DESCRIPTION
    Installs npm dependencies, bundles the extension via esbuild,
    and copies static assets to the output directory.
#>

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== KC DevKit Build ===" -ForegroundColor Cyan
Set-Location $ProjectRoot

# Step 1: Install dependencies
Write-Host "[1/4] Installing npm dependencies..." -ForegroundColor Yellow
npm install --no-audit --no-fund 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# Step 2: Bundle extension host code (Node.js)
Write-Host "[2/4] Bundling extension (esbuild: Node platform)..." -ForegroundColor Yellow
$esbuild = Join-Path $ProjectRoot "node_modules/.bin/esbuild"

& $esbuild src/extension.ts `
    --bundle `
    --outfile=out/extension.js `
    --platform=node `
    --target=es2020 `
    --format=cjs `
    --external:vscode `
    --minify `
    --sourcemap

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: esbuild (extension) failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# Step 3: Bundle mermaid preview script (Browser)
Write-Host "[3/4] Bundling mermaid-init (esbuild: Browser platform)..." -ForegroundColor Yellow

& $esbuild preview-scripts/mermaid-init-src.js `
    --bundle `
    --outfile=preview-scripts/mermaid-init.js `
    --platform=browser `
    --target=es2020 `
    --format=iife `
    --minify

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: esbuild (mermaid) failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# Step 4: Verify output
Write-Host "[4/4] Verifying outputs..." -ForegroundColor Yellow
$requiredFiles = @(
    "out/extension.js",
    "preview-scripts/mermaid-init.js",
    "styles/katex.min.css",
    "styles/mermaid.css",
    "styles/line-number.css",
    "syntaxes/sage.tmLanguage.json",
    "snippets/sage.json",
    "package.json",
    "icon.png"
)

$missing = @()
foreach ($f in $requiredFiles) {
    $fullPath = Join-Path $ProjectRoot $f
    if (-not (Test-Path $fullPath)) {
        $missing += $f
    }
}

if ($missing.Count -gt 0) {
    Write-Host "WARNING: Missing files (non-fatal):" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
} else {
    Write-Host "  All output files present" -ForegroundColor Green
}

# Summary
$extSize = (Get-Item (Join-Path $ProjectRoot "out/extension.js")).Length / 1KB
$mermaidSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/mermaid-init.js")).Length / 1KB
Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Cyan
Write-Host "  extension.js:  $([math]::Round($extSize, 1)) KB" -ForegroundColor White
Write-Host "  mermaid-init.js: $([math]::Round($mermaidSize, 1)) KB" -ForegroundColor White
