# Rewrite /dashboard/<path> -> /<path> across all source files.
# Why: Next.js route group (dashboard) does NOT add to the URL.
# So (dashboard)/borrowers/page.tsx is at /borrowers, not /dashboard/borrowers.
# Bare "/dashboard" (the dashboard page itself) is left alone.
#
# Safety:
#   - Regex `/dashboard/(.+)` only matches when followed by a path segment.
#   - Bare "/dashboard" (no trailing slash+segment) is not touched.
#   - We rewrite .ts and .tsx files under src/.
#   - A backup of src/ was made before running this.

$ErrorActionPreference = 'Stop'
$srcRoot = 'C:\Users\RICHARD_TEMBO\Desktop\Projects\malimind\ruthex-lms\src'

$files = Get-ChildItem -Path $srcRoot -Recurse -File -Include '*.ts', '*.tsx' |
    Where-Object { $_.FullName -notmatch 'node_modules' }

$changed = 0
$unchanged = 0
foreach ($f in $files) {
    $orig = [System.IO.File]::ReadAllText($f.FullName)
    # Replace /dashboard/<something> -> /<something>. Bare /dashboard is safe.
    $new = [System.Text.RegularExpressions.Regex]::Replace(
        $orig,
        '/dashboard/(?=[A-Za-z_])',
        '/'
    )
    if ($new -ne $orig) {
        [System.IO.File]::WriteAllText($f.FullName, $new)
        $changed++
        Write-Host ("changed: {0}" -f $f.FullName.Replace($srcRoot, ''))
    } else {
        $unchanged++
    }
}
Write-Host ""
Write-Host ("files changed:   {0}" -f $changed)
Write-Host ("files unchanged: {0}" -f $unchanged)
