# Regenerates RUTHEX brand icons with a solid RUTHEX Green (#0B5D3B) background.
# Source: /public/logo.png (transparent PNG, dark green R + white arrow + gold leg).
# Outputs: /public/icon-192.png, /public/icon-512.png, /public/apple-touch-icon.png, /public/favicon-96x96.png.
#
# Padding: ~10% of icon edge so the logo mark breathes inside the square.
# Why green bg: the white arrow and gold leg stay high-contrast on RUTHEX Green;
# the dark green R is defined by the emerald highlight curve so it doesn't disappear.

Add-Type -AssemblyName System.Drawing

$projectRoot = 'C:\Users\RICHARD_TEMBO\Desktop\Projects\malimind\ruthex-lms'
$logoPath    = Join-Path $projectRoot 'public\logo.png'
$publicDir   = Join-Path $projectRoot 'public'

# RUTHEX Green (#0B5D3B) -> (R=11, G=93, B=59)
$bgColor = [System.Drawing.Color]::FromArgb(255, 11, 93, 59)

# Targets: size (px) -> filename. favicon-96 is kept for legacy browsers.
$targets = @(
    @{ Size = 96;  Out = 'favicon-96x96.png' },
    @{ Size = 180; Out = 'apple-touch-icon.png' },
    @{ Size = 192; Out = 'icon-192.png' },
    @{ Size = 512; Out = 'icon-512.png' }
)

# Load the source logo as a Bitmap so we can draw it onto each output canvas.
$src = [System.Drawing.Bitmap]::FromFile($logoPath)
$srcW = $src.Width
$srcH = $src.Height

foreach ($t in $targets) {
    $size = $t.Size
    $out  = Join-Path $publicDir $t.Out

    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Fill background.
    $g.Clear($bgColor)

    # Logo inset: 10% padding on each side -> logo fills 80% of the square.
    $inset   = [int][Math]::Round($size * 0.10)
    $destW   = $size - 2 * $inset
    $destH   = $destW                  # keep aspect 1:1 (logo is square)
    $destX   = $inset
    $destY   = $inset

    $g.DrawImage($src, $destX, $destY, $destW, $destH)

    # Save as PNG.
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()

    $info = Get-Item $out
    Write-Host ("wrote {0}  {1}x{1}  {2} bytes" -f $out, $size, $info.Length)
}

$src.Dispose()
