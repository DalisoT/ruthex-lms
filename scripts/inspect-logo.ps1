Add-Type -AssemblyName System.Drawing
$logoPath = 'C:\Users\RICHARD_TEMBO\Desktop\Projects\malimind\ruthex-lms\public\logo.png'
$im = [System.Drawing.Image]::FromFile($logoPath)
Write-Host ("size={0}x{1} pxFormat={2}" -f $im.Width, $im.Height, $im.PixelFormat)

# Count transparent pixels and dominant colors
$bmp = New-Object System.Drawing.Bitmap $logoPath
$total = $bmp.Width * $bmp.Height
$transparent = 0
$opaque = 0
$colorCounts = @{}
for ($y = 0; $y -lt $bmp.Height; $y += 4) {
    for ($x = 0; $x -lt $bmp.Width; $x += 4) {
        $px = $bmp.GetPixel($x, $y)
        if ($px.A -lt 16) {
            $transparent++
        } else {
            $opaque++
            # Bucket to nearest 32
            $r = [Math]::Floor($px.R / 32) * 32
            $g = [Math]::Floor($px.G / 32) * 32
            $b = [Math]::Floor($px.B / 32) * 32
            $key = ("#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b)
            if ($colorCounts.ContainsKey($key)) { $colorCounts[$key]++ } else { $colorCounts[$key] = 1 }
        }
    }
}
Write-Host ("sampled={0} transparent={1} opaque={2}" -f (($transparent + $opaque)), $transparent, $opaque)
Write-Host "Top 8 opaque color buckets:"
$colorCounts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 8 | ForEach-Object { Write-Host ("  {0}  count={1}" -f $_.Key, $_.Value) }
$bmp.Dispose()
$im.Dispose()
