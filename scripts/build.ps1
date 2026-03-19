<#
.SYNOPSIS
    KC DevKit — Build Script
.DESCRIPTION
    Installs npm dependencies, bundles the extension via esbuild,
    and copies static assets to the output directory.
#>

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Read version from package.json (single source of truth)
$pkgJson = Get-Content (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json
$Version = $pkgJson.version

Write-Host "=== KC DevKit Build v$Version ===" -ForegroundColor Cyan
Set-Location $ProjectRoot

# Step 1: Install dependencies
Write-Host "[1/7] Installing npm dependencies..." -ForegroundColor Yellow
npm install --no-audit --no-fund 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# Step 2: Bundle extension host code (Node.js)
Write-Host "[2/7] Bundling extension (esbuild: Node platform)..." -ForegroundColor Yellow
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

# Step 3: Bundle mermaid-init preview script (Browser, no-bundle — uses global mermaid)
Write-Host "[3/7] Bundling mermaid-init (esbuild: Browser platform, no external deps)..." -ForegroundColor Yellow

& $esbuild preview-scripts/mermaid-init-src.js `
    --outfile=preview-scripts/mermaid-init.js `
    --platform=browser `
    --target=es2020 `
    --format=iife `
    --minify

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: esbuild (mermaid-init) failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# Step 4: Bundle toc-init preview script (Browser, no-bundle)
Write-Host "[4/7] Bundling toc-init (esbuild: Browser platform)..." -ForegroundColor Yellow

& $esbuild preview-scripts/toc-init-src.js `
    --outfile=preview-scripts/toc-init.js `
    --platform=browser `
    --target=es2020 `
    --format=iife `
    --minify

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: esbuild (toc-init) failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# Step 5: Copy pre-built mermaid.min.js (globalThis.mermaid)
Write-Host "[5/7] Copying mermaid.min.js (pre-built)..." -ForegroundColor Yellow
$mermaidSrc = Join-Path $ProjectRoot "node_modules/mermaid/dist/mermaid.min.js"
$mermaidDst = Join-Path $ProjectRoot "preview-scripts/mermaid.min.js"
Copy-Item $mermaidSrc $mermaidDst -Force
Write-Host "  OK" -ForegroundColor Green

# Step 5: Verify output
Write-Host "[6/7] Verifying outputs..." -ForegroundColor Yellow
$requiredFiles = @(
    "out/extension.js",
    "preview-scripts/mermaid.min.js",
    "preview-scripts/mermaid-init.js",
    "preview-scripts/toc-init.js",
    "styles/katex.min.css",
    "styles/mermaid.css",
    "styles/line-number.css",
    "styles/toc.css",
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

# Step 7: Summary
$extSize = (Get-Item (Join-Path $ProjectRoot "out/extension.js")).Length / 1KB
$mermaidLibSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/mermaid.min.js")).Length / 1KB
$mermaidInitSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/mermaid-init.js")).Length / 1KB
$tocInitSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/toc-init.js")).Length / 1KB
Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Cyan
Write-Host "  extension.js:    $([math]::Round($extSize, 1)) KB" -ForegroundColor White
Write-Host "  mermaid.min.js:  $([math]::Round($mermaidLibSize, 1)) KB (pre-built)" -ForegroundColor White
Write-Host "  mermaid-init.js: $([math]::Round($mermaidInitSize, 1)) KB (init logic)" -ForegroundColor White
Write-Host "  toc-init.js:     $([math]::Round($tocInitSize, 1)) KB (TOC panel)" -ForegroundColor White
