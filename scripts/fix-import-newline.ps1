# Fix the broken import line: replace literal "\nimport" with actual newline + import.
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\RICHARD_TEMBO\Desktop\Projects\malimind\ruthex-lms\src\app\api'

$files = Get-ChildItem -Path $root -Recurse -File -Filter '*.ts'

$changed = 0
foreach ($f in $files) {
    $orig = [System.IO.File]::ReadAllText($f.FullName)
    $new = $orig -replace "request-body';\\nimport", "request-body';`nimport"
    if ($new -ne $orig) {
        [System.IO.File]::WriteAllText($f.FullName, $new)
        Write-Host ("fixed: {0}" -f $f.FullName.Replace($root, ''))
        $changed++
    }
}
Write-Host ("`nfiles fixed: {0}" -f $changed)
