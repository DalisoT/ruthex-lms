# Rewrite all `await req.json()` patterns in API routes to use readJsonBody().
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\RICHARD_TEMBO\Desktop\Projects\malimind\ruthex-lms\src\app\api'

# Two specific source patterns to replace (the exact form used in every route)
$sourceA = "try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }"
$replacementA = "const body = await readJsonBody(req);`n  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });"

$sourceB = "const j = await req.json().catch(() => ({}));"
$replacementB = "const j = (await readJsonBody(req)) ?? {};"

$sourceC = "try { body = await req.json(); } catch { /* allow empty body */ }"
$replacementC = "const body = await readJsonBody(req);"

$files = Get-ChildItem -Path $root -Recurse -File -Filter '*.ts'

$changed = 0
foreach ($f in $files) {
    $orig = [System.IO.File]::ReadAllText($f.FullName)
    $new = $orig
    $new = $new.Replace($sourceA, $replacementA)
    $new = $new.Replace($sourceB, $replacementB)
    $new = $new.Replace($sourceC, $replacementC)
    if ($new -ne $orig) {
        if ($new -notmatch "from '@/lib/request-body'") {
            $new = [System.Text.RegularExpressions.Regex]::Replace(
                $new,
                "(import [^\n]+\n)",
                "`$1import { readJsonBody } from '@/lib/request-body';\n",
                1
            )
        }
        [System.IO.File]::WriteAllText($f.FullName, $new)
        Write-Host ("updated: {0}" -f $f.FullName.Replace($root, ''))
        $changed++
    }
}
Write-Host ("`nfiles changed: {0}" -f $changed)
