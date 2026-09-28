<#
.SYNOPSIS
    KC DevKit — Build Script
.DESCRIPTION
    Installs npm dependencies, bundles the extension via esbuild,
    and copies static assets (KaTeX, Mermaid, pdf.js) to packaged dirs.
#>

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$pkgJson = Get-Content (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json
$Version = $pkgJson.version

Write-Host "=== KC DevKit Build v$Version ===" -ForegroundColor Cyan
Set-Location $ProjectRoot

function Copy-FirstExisting {
    param(
        [string]$SourceDir,
        [string[]]$Names,
        [string]$DestDir,
        [string]$Label
    )
    foreach ($name in $Names) {
        $src = Join-Path $SourceDir $name
        if (Test-Path $src) {
            New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
            Copy-Item $src (Join-Path $DestDir $name) -Force
            Write-Host "  copied $Label : $name" -ForegroundColor DarkGray
            return $name
        }
    }
    throw "Missing $Label in $SourceDir (tried: $($Names -join ', '))"
}

# Step 1: Install dependencies
Write-Host "[1/8] Installing npm dependencies..." -ForegroundColor Yellow
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

$esbuild = Join-Path $ProjectRoot "node_modules\.bin\esbuild.cmd"
if (-not (Test-Path $esbuild)) {
    $esbuild = Join-Path $ProjectRoot "node_modules\.bin\esbuild"
}

# Step 2: Bundle extension host code (Node.js) — do not import pdfjs here
Write-Host "[2/8] Bundling extension (esbuild: Node platform)..." -ForegroundColor Yellow
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

# Step 3: Bundle mermaid-init preview script
Write-Host "[3/8] Bundling mermaid-init (esbuild: Browser platform)..." -ForegroundColor Yellow
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

# Step 4: Bundle toc-init preview script
Write-Host "[4/8] Bundling toc-init (esbuild: Browser platform)..." -ForegroundColor Yellow
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

# Step 5: Bundle PDF webview viewer (browser ESM, no pdfjs in this bundle)
Write-Host "[5/8] Bundling pdf-viewer (esbuild: Browser ESM)..." -ForegroundColor Yellow
& $esbuild src/pdf/webview/viewer.ts `
    --bundle `
    --outfile=preview-scripts/pdf-viewer.js `
    --platform=browser `
    --target=es2020 `
    --format=esm `
    --minify
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: esbuild (pdf-viewer) failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# Step 5b: Bundle Excel webview viewer (browser ESM, parse happens in extension host)
Write-Host "[5b/8] Bundling excel-viewer (esbuild: Browser ESM)..." -ForegroundColor Yellow
& $esbuild src/excel/webview/viewer.ts `
    --bundle `
    --outfile=preview-scripts/excel-viewer.js `
    --platform=browser `
    --target=es2020 `
    --format=esm `
    --minify
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: esbuild (excel-viewer) failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

Write-Host "[5c/8] Bundling ppt-viewer (esbuild: Browser ESM)..." -ForegroundColor Yellow
& $esbuild src/ppt/webview/viewer.ts `
    --bundle `
    --outfile=preview-scripts/ppt-viewer.js `
    --platform=browser `
    --target=es2020 `
    --format=esm `
    --minify
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: esbuild (ppt-viewer) failed" -ForegroundColor Red
    exit 1
}
Write-Host "  OK" -ForegroundColor Green

# Step 6: Copy static assets
Write-Host "[6/8] Copying static assets..." -ForegroundColor Yellow

$mermaidSrc = Join-Path $ProjectRoot "node_modules/mermaid/dist/mermaid.min.js"
$mermaidDst = Join-Path $ProjectRoot "preview-scripts/mermaid.min.js"
if (-not (Test-Path $mermaidSrc)) {
    Write-Host "ERROR: mermaid.min.js not found" -ForegroundColor Red
    exit 1
}
Copy-Item $mermaidSrc $mermaidDst -Force

$katexCssSrc = Join-Path $ProjectRoot "node_modules/katex/dist/katex.min.css"
$katexCssDst = Join-Path $ProjectRoot "styles/katex.min.css"
if (-not (Test-Path $katexCssSrc)) {
    Write-Host "ERROR: katex.min.css not found" -ForegroundColor Red
    exit 1
}
Copy-Item $katexCssSrc $katexCssDst -Force

$katexFontsSrc = Join-Path $ProjectRoot "node_modules/katex/dist/fonts"
$katexFontsDst = Join-Path $ProjectRoot "styles/fonts"
if (Test-Path $katexFontsSrc) {
    New-Item -ItemType Directory -Path $katexFontsDst -Force | Out-Null
    Get-ChildItem -Path $katexFontsSrc -Filter "*.woff2" | Copy-Item -Destination $katexFontsDst -Force
    $fontCount = (Get-ChildItem -Path $katexFontsDst -Filter "*.woff2").Count
    Write-Host "  katex woff2 fonts: $fontCount" -ForegroundColor DarkGray
} else {
    Write-Host "  WARNING: katex fonts directory missing" -ForegroundColor Yellow
}

$pdfjsRoot = Join-Path $ProjectRoot "node_modules/pdfjs-dist"
$legacyDir = Join-Path $pdfjsRoot "legacy/build"
$modernDir = Join-Path $pdfjsRoot "build"
$vendorDir = Join-Path $ProjectRoot "vendor/pdfjs"
if (Test-Path $vendorDir) {
    Remove-Item $vendorDir -Recurse -Force
}
New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null

$pdfLibDir = if (Test-Path $legacyDir) { $legacyDir } else { $modernDir }
if (-not (Test-Path $pdfLibDir)) {
    Write-Host "ERROR: pdfjs-dist build directory not found" -ForegroundColor Red
    exit 1
}

try {
    Copy-FirstExisting -SourceDir $pdfLibDir -Names @("pdf.min.mjs", "pdf.mjs", "pdf.min.js", "pdf.js") -DestDir $vendorDir -Label "pdf.js lib" | Out-Null
    Copy-FirstExisting -SourceDir $pdfLibDir -Names @("pdf.worker.min.mjs", "pdf.worker.mjs", "pdf.worker.min.js", "pdf.worker.js") -DestDir $vendorDir -Label "pdf.js worker" | Out-Null
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    exit 1
}

$cmapsSrc = Join-Path $pdfjsRoot "cmaps"
$fontsSrc = Join-Path $pdfjsRoot "standard_fonts"
if (-not (Test-Path $cmapsSrc)) {
    Write-Host "ERROR: pdfjs-dist cmaps/ missing" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $fontsSrc)) {
    Write-Host "ERROR: pdfjs-dist standard_fonts/ missing" -ForegroundColor Red
    exit 1
}
Copy-Item $cmapsSrc (Join-Path $vendorDir "cmaps") -Recurse -Force
Copy-Item $fontsSrc (Join-Path $vendorDir "standard_fonts") -Recurse -Force

$wasmSrc = Join-Path $pdfjsRoot "wasm"
if (Test-Path $wasmSrc) {
    $wasmFiles = Get-ChildItem -Path $wasmSrc -File -ErrorAction SilentlyContinue
    if ($wasmFiles -and $wasmFiles.Count -gt 0) {
        Copy-Item $wasmSrc (Join-Path $vendorDir "wasm") -Recurse -Force
        Write-Host "  copied pdf.js wasm/" -ForegroundColor DarkGray
    }
}

Write-Host "  OK" -ForegroundColor Green

# Step 7: Verify outputs (pdf worker/cmaps/standard_fonts are fatal)
Write-Host "[7/8] Verifying outputs..." -ForegroundColor Yellow
$requiredFiles = @(
    "out/extension.js",
    "preview-scripts/mermaid.min.js",
    "preview-scripts/mermaid-init.js",
    "preview-scripts/toc-init.js",
    "preview-scripts/pdf-viewer.js",
    "preview-scripts/excel-viewer.js",
    "preview-scripts/ppt-viewer.js",
    "styles/katex.min.css",
    "styles/mermaid.css",
    "styles/line-number.css",
    "styles/toc.css",
    "styles/pdf-preview.css",
    "styles/excel-preview.css",
    "styles/ppt-preview.css",
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

$fatalMissing = @()
$workerHit = $false
foreach ($name in @("pdf.worker.min.mjs", "pdf.worker.mjs", "pdf.worker.min.js", "pdf.worker.js")) {
    if (Test-Path (Join-Path $vendorDir $name)) { $workerHit = $true }
}
if (-not $workerHit) { $fatalMissing += "vendor/pdfjs/pdf.worker.*" }

$cmapsDst = Join-Path $vendorDir "cmaps"
$fontsDst = Join-Path $vendorDir "standard_fonts"
if (-not (Test-Path $cmapsDst) -or -not (Get-ChildItem $cmapsDst | Select-Object -First 1)) {
    $fatalMissing += "vendor/pdfjs/cmaps/"
}
if (-not (Test-Path $fontsDst) -or -not (Get-ChildItem $fontsDst | Select-Object -First 1)) {
    $fatalMissing += "vendor/pdfjs/standard_fonts/"
}

if ($fatalMissing.Count -gt 0) {
    Write-Host "ERROR: Required pdf.js assets missing:" -ForegroundColor Red
    $fatalMissing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

if ($missing.Count -gt 0) {
    Write-Host "WARNING: Missing files (non-fatal):" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
} else {
    Write-Host "  All output files present" -ForegroundColor Green
}

# Step 8: Summary
$extSize = (Get-Item (Join-Path $ProjectRoot "out/extension.js")).Length / 1KB
$mermaidLibSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/mermaid.min.js")).Length / 1KB
$mermaidInitSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/mermaid-init.js")).Length / 1KB
$tocInitSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/toc-init.js")).Length / 1KB
$pdfViewerSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/pdf-viewer.js")).Length / 1KB
$excelViewerSize = (Get-Item (Join-Path $ProjectRoot "preview-scripts/excel-viewer.js")).Length / 1KB
$vendorSize = ((Get-ChildItem $vendorDir -Recurse -File | Measure-Object -Property Length -Sum).Sum) / 1MB

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Cyan
Write-Host "  extension.js:    $([math]::Round($extSize, 1)) KB" -ForegroundColor White
Write-Host "  mermaid.min.js:  $([math]::Round($mermaidLibSize, 1)) KB (pre-built)" -ForegroundColor White
Write-Host "  mermaid-init.js: $([math]::Round($mermaidInitSize, 1)) KB" -ForegroundColor White
Write-Host "  toc-init.js:     $([math]::Round($tocInitSize, 1)) KB" -ForegroundColor White
Write-Host "  pdf-viewer.js:   $([math]::Round($pdfViewerSize, 1)) KB" -ForegroundColor White
Write-Host "  excel-viewer.js: $([math]::Round($excelViewerSize, 1)) KB" -ForegroundColor White
Write-Host "  vendor/pdfjs:    $([math]::Round($vendorSize, 2)) MB" -ForegroundColor White
