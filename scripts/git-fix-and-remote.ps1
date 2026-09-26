# Fix the first commit: exclude the misplaced SQLite DB, then add the remote.

$ErrorActionPreference = 'Stop'
$repo   = 'C:\Users\RICHARD_TEMBO\Desktop\Projects\malimind\ruthex-lms'
$remote = 'https://github.com/DalisoT/ruthex-lms.git'

Set-Location $repo

# 1. Update .gitignore to exclude the doubly-nested prisma DB path.
$gi = Join-Path $repo '.gitignore'
$giText = Get-Content $gi -Raw
if ($giText -notmatch 'prisma/prisma') {
    Add-Content -Path $gi -Value "`n# Misplaced DB resolved from DATABASE_URL=file:./prisma/dev.db (one-off)`nprisma/prisma/`n"
    Write-Host 'added prisma/prisma/ to .gitignore'
}

# 2. Unstage any tracked files matching the new ignore pattern.
git rm --cached -r prisma/prisma 2>&1 | Out-Null
Write-Host 'unstaged prisma/prisma/ from the index'

# 3. Re-stage .gitignore and amend the commit.
git add .gitignore
git commit --amend --no-edit | Out-Null
Write-Host ''
Write-Host '=== amended commit ==='
git log --oneline -1
Write-Host ''
Write-Host '=== staged contents in the commit (top of tree) ==='
git ls-tree -r HEAD --name-only | Select-String -Pattern 'prisma/dev|prisma/prisma|\.env$|node_modules' | ForEach-Object { Write-Host ("  {0}" -f $_) }

# 4. Add the GitHub remote (the earlier `2>$null` swallowed a real error).
$existing = git remote 2>&1
if ($existing -notmatch '^origin$') {
    git remote add origin $remote
    Write-Host ("remote added: origin -> {0}" -f $remote)
} else {
    Write-Host ("remote already set: origin -> {0}" -f (git remote get-url origin))
}

Write-Host ''
Write-Host '=== final remotes ==='
git remote -v
Write-Host ''
Write-Host '=== current branch ==='
git branch --show-current
