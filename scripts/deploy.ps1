<#
.SYNOPSIS
    KC DevKit — Deploy Script
.DESCRIPTION
    Builds the extension, packages it as a .vsix, optionally publishes
    to the VS Code Marketplace (only with -Publish and AZURE_PAT), and
    installs into Cursor (preferred) and VS Code.
.PARAMETER Publish
    If set, publish to the Marketplace when AZURE_PAT is available.
    Default is off so a local deploy never publishes accidentally.
#>

[CmdletBinding()]
param(
    [switch]$Publish
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$pkgJson = Get-Content (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json
$Version = $pkgJson.version
$ExtFolderName = "kn1ghtc.kc-devkit-$Version"

Write-Host "=== KC DevKit Deploy v$Version ===" -ForegroundColor Cyan
Set-Location $ProjectRoot

# Step 1: Parse .env file for AZURE_PAT / OPENVSX_TOKEN (walk up to workspace root)
$pat = $null
$ovsxToken = $null

function Find-EnvFile($startDir) {
    $dir = $startDir
    while ($dir) {
        $candidate = Join-Path $dir ".env"
        if (Test-Path $candidate) { return $candidate }
        $parent = Split-Path $dir -Parent
        if ($parent -eq $dir) { break }
        $dir = $parent
    }
    return $null
}

function Find-CursorInstallRoot {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Cursor"),
        (Join-Path $env:LOCALAPPDATA "Programs\cursor")
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

function Find-CursorCli {
    foreach ($name in @("cursor", "cursor.cmd")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if (-not $cmd) { continue }
        $src = $cmd.Source
        if (-not $src) { $src = $cmd.Path }
        if (-not $src) { continue }
        if ($src -notmatch '\.cmd$') {
            $asCmd = "$src.cmd"
            if (Test-Path $asCmd) { return $asCmd }
        }
        if (Test-Path $src) { return $src }
    }

    $portable = "D:\cursor\resources\app\bin\cursor.cmd"
    if (Test-Path $portable) { return $portable }

    $root = Find-CursorInstallRoot
    if (-not $root) { return $null }
    foreach ($name in @("cursor.cmd", "code.cmd")) {
        $hits = @(Get-ChildItem -Path $root -Recurse -Filter $name -File -ErrorAction SilentlyContinue)
        if ($hits.Count -eq 0) { continue }
        $inBin = $hits | Where-Object { $_.Directory.Name -eq "bin" } | Select-Object -First 1
        if ($inBin) { return $inBin.FullName }
        return $hits[0].FullName
    }
    return $null
}

function Install-VsixFallback {
    param(
        [string]$VsixPath,
        [string]$FolderName
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $destRoot = Join-Path $env:USERPROFILE ".cursor\extensions"
    $dest = Join-Path $destRoot $FolderName
    $tmp = Join-Path $env:TEMP ("kc-devkit-vsix-" + [guid]::NewGuid().ToString("n"))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        $zipPath = Join-Path $tmp "extension.zip"
        Copy-Item $VsixPath $zipPath
        $extract = Join-Path $tmp "extracted"
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extract)
        $extDir = Join-Path $extract "extension"
        if (-not (Test-Path $extDir)) {
            throw "VSIX does not contain an extension/ directory"
        }
        New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
        if (Test-Path $dest) {
            Remove-Item $dest -Recurse -Force
        }
        Copy-Item $extDir $dest -Recurse
        return $dest
    } finally {
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-InstallExtension {
    param(
        [string]$Command,
        [string[]]$CommandArgs,
        [string]$Label
    )
    Write-Host "  Trying $Label..." -ForegroundColor DarkGray
    & $Command @CommandArgs
    return ($LASTEXITCODE -eq 0)
}

function Enable-NodeHttpProxy {
    $preload = Join-Path $ProjectRoot "scripts\node-env-proxy-preload.js"
    if (-not (Test-Path $preload)) { return }
    $flag = "--require=$($preload.Replace('\', '/'))"
    if ($env:NODE_OPTIONS) {
        if ($env:NODE_OPTIONS -notlike "*node-env-proxy-preload.js*") {
            $env:NODE_OPTIONS = "$($env:NODE_OPTIONS.Trim()) $flag"
        }
    } else {
        $env:NODE_OPTIONS = $flag
    }
    if ($env:NO_PROXY -eq '://:' -or $env:no_proxy -eq '://:') {
        Remove-Item Env:NO_PROXY -ErrorAction SilentlyContinue
        Remove-Item Env:no_proxy -ErrorAction SilentlyContinue
    }
    Write-Host "  Node HTTP proxy preload enabled (HTTPS_PROXY)." -ForegroundColor DarkGray
}

$envFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envFile)) {
    $envFile = Find-EnvFile $ProjectRoot
}

if ($envFile -and (Test-Path $envFile)) {
    Write-Host "  Using .env: $envFile" -ForegroundColor DarkGray
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $val, 'Process')
            if ($key -eq 'AZURE_PAT') {
                $script:pat = $val
            }
            if ($key -eq 'OPENVSX_TOKEN' -or $key -eq 'OVSX_PAT') {
                $script:ovsxToken = $val
            }
        }
    }
}

if (-not $pat) {
    $pat = $env:AZURE_PAT
}
if (-not $ovsxToken) {
    $ovsxToken = $env:OPENVSX_TOKEN
    if (-not $ovsxToken) { $ovsxToken = $env:OVSX_PAT }
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
Get-ChildItem -Path $ProjectRoot -Filter "*.vsix" | Remove-Item -Force

npx vsce package --no-dependencies 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: VSIX packaging failed" -ForegroundColor Red
    exit 1
}

$vsix = Get-ChildItem -Path $ProjectRoot -Filter "*.vsix" | Select-Object -First 1
if (-not $vsix) {
    Write-Host "ERROR: No .vsix file found" -ForegroundColor Red
    exit 1
}

$vsixSize = $vsix.Length / 1MB
Write-Host "  VSIX: $($vsix.Name) ($([math]::Round($vsixSize, 2)) MB)" -ForegroundColor Green

# Step 4: Publish only with -Publish; then install locally (prefer Cursor)
Write-Host "[3/3] Publishing / Installing..." -ForegroundColor Yellow

$published = $false
$publishedOvsx = $false
if ($Publish -and $pat) {
    Write-Host "  -Publish set and AZURE_PAT found — publishing to VS Code Marketplace..." -ForegroundColor Cyan
    $env:VSCE_PAT = $pat
    npx vsce publish --no-dependencies 2>&1
    $vsceCode = $LASTEXITCODE
    Remove-Item Env:VSCE_PAT -ErrorAction SilentlyContinue
    if ($vsceCode -ne 0) {
        Write-Host "WARNING: VS Code Marketplace publish failed. Installing locally instead." -ForegroundColor Yellow
    } else {
        Write-Host "  Published to VS Code Marketplace!" -ForegroundColor Green
        $published = $true
    }
} elseif ($Publish -and -not $pat) {
    Write-Host "  -Publish set but AZURE_PAT missing — skip VS Code Marketplace." -ForegroundColor Yellow
} else {
    Write-Host "  VS Code Marketplace: skipped (pass -Publish to publish)." -ForegroundColor DarkGray
}

if ($Publish -and $ovsxToken) {
    Write-Host "  -Publish set and Open VSX token found — publishing to Open VSX (Cursor)..." -ForegroundColor Cyan
    Enable-NodeHttpProxy
    $env:OVSX_PAT = $ovsxToken
    npx ovsx publish $vsix.FullName 2>&1
    $ovsxCode = $LASTEXITCODE
    Remove-Item Env:OVSX_PAT -ErrorAction SilentlyContinue
    if ($ovsxCode -ne 0) {
        Write-Host "WARNING: Open VSX publish failed." -ForegroundColor Yellow
    } else {
        Write-Host "  Published to Open VSX (Cursor marketplace)!" -ForegroundColor Green
        $publishedOvsx = $true
    }
} elseif ($Publish -and -not $ovsxToken) {
    Write-Host "  -Publish set but OPENVSX_TOKEN/OVSX_PAT missing — skip Open VSX." -ForegroundColor Yellow
}

$installArgs = @("--install-extension", $vsix.FullName, "--force")
$cursorInstalled = $false
$cursorRoot = Find-CursorInstallRoot
$cursorCli = Find-CursorCli

if ($cursorCli) {
    $cursorInstalled = Invoke-InstallExtension -Command $cursorCli -CommandArgs $installArgs -Label $cursorCli
}

if (-not $cursorInstalled -and $cursorRoot) {
    $cursorExe = Join-Path $cursorRoot "Cursor.exe"
    if (-not (Test-Path $cursorExe)) {
        $cursorExe = Join-Path $cursorRoot "cursor.exe"
    }
    if (Test-Path $cursorExe) {
        $cursorInstalled = Invoke-InstallExtension -Command $cursorExe -CommandArgs $installArgs -Label $cursorExe
    }
}

if (-not $cursorInstalled) {
    Write-Host "  Cursor CLI unavailable — unzipping VSIX into .cursor/extensions..." -ForegroundColor Yellow
    try {
        $dest = Install-VsixFallback -VsixPath $vsix.FullName -FolderName $ExtFolderName
        Write-Host "  Fallback install: $dest" -ForegroundColor Green
        $cursorInstalled = $true
    } catch {
        Write-Host "WARNING: Cursor fallback install failed: $_" -ForegroundColor Yellow
    }
}

$codeInstalled = $false
$codeCmd = Get-Command code -ErrorAction SilentlyContinue
if ($codeCmd) {
    $codeInstalled = Invoke-InstallExtension -Command "code" -CommandArgs $installArgs -Label "code"
    if (-not $codeInstalled) {
        Write-Host "WARNING: VS Code local install failed" -ForegroundColor Yellow
    }
} else {
    Write-Host "  VS Code 'code' CLI not on PATH — skipped" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== Deploy Complete ===" -ForegroundColor Cyan
if ($published) {
    Write-Host "  VS Code Marketplace: Published" -ForegroundColor Green
} else {
    Write-Host "  VS Code Marketplace: Skipped or failed (use -Publish and AZURE_PAT)" -ForegroundColor Yellow
}
if ($publishedOvsx) {
    Write-Host "  Open VSX (Cursor): Published" -ForegroundColor Green
} else {
    Write-Host "  Open VSX (Cursor): Skipped or failed (use -Publish and OPENVSX_TOKEN)" -ForegroundColor Yellow
}
if ($cursorInstalled) {
    Write-Host "  Cursor: Installed" -ForegroundColor Green
} else {
    Write-Host "  Cursor: FAILED" -ForegroundColor Yellow
}
if ($codeInstalled) {
    Write-Host "  VS Code: Installed" -ForegroundColor Green
} else {
    Write-Host "  VS Code: Skipped or failed" -ForegroundColor Yellow
}
Write-Host "  VSIX: $($vsix.Name) ($([math]::Round($vsixSize, 2)) MB)" -ForegroundColor White
Write-Host "  Reload Cursor/VS Code window after install (Developer: Reload Window)." -ForegroundColor White
