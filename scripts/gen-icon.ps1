Add-Type -AssemblyName System.Drawing

$w = 256
$h = 256
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'HighQuality'
$g.TextRenderingHint = 'AntiAliasGridFit'

# Gradient background
$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.ColorTranslator]::FromHtml('#1a1a2e'),
    [System.Drawing.ColorTranslator]::FromHtml('#16213e'),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
)
$g.FillRectangle($brush, $rect)

# Border
$pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#0f3460'), 3)
$g.DrawRectangle($pen, 2, 2, ($w - 4), ($h - 4))

# 'KC' text
$font = New-Object System.Drawing.Font('Consolas', 88, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$textRect = New-Object System.Drawing.RectangleF(0, -10, $w, $h)
$g.DrawString('KC', $font, $textBrush, $textRect, $sf)

# Subtitle
$subFont = New-Object System.Drawing.Font('Consolas', 18, [System.Drawing.FontStyle]::Regular)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#e94560'))
$subRect = New-Object System.Drawing.RectangleF(0, 75, $w, $h)
$g.DrawString('DevKit', $subFont, $subBrush, $subRect, $sf)

$outPath = Join-Path $PSScriptRoot '..\icon.png'
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Host "icon.png created: $outPath" -ForegroundColor Green
Write-Host "Size: $((Get-Item $outPath).Length) bytes"
