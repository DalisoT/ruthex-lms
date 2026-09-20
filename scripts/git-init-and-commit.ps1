# Initialize local git repo and make the first commit for RUTHEX LMS.
# Assumes:
#   - Project is at C:\Users\RICHARD_TEMBO\Desktop\Projects\malimind\ruthex-lms
#   - Target remote is https://github.com/DalisoT/ruthex-lms.git (HTTPS)
#   - Author identity is local-only (does not modify global git config)

$ErrorActionPreference = 'Stop'
$repo    = 'C:\Users\RICHARD_TEMBO\Desktop\Projects\malimind\ruthex-lms'
$remote  = 'https://github.com/DalisoT/ruthex-lms.git'
$name    = 'Richard Tembo'
# GitHub noreply format using the DalisoT user id (119164795) so commits get the
# verified badge without exposing a real inbox. User can amend later.
$email   = '119164795+DalisoT@users.noreply.github.com'

Set-Location $repo

# 1. Update .gitignore to skip the backup folder we created during the route fix.
$gi = Join-Path $repo '.gitignore'
$giText = Get-Content $gi -Raw
if ($giText -notmatch 'src\.bak-routes') {
    Add-Content -Path $gi -Value "`n# Local backups generated during development`nsrc.bak-routes/`n"
    Write-Host 'added src.bak-routes/ to .gitignore'
}

# 2. Init repo (if not already) and set local author identity.
if (-not (Test-Path (Join-Path $repo '.git'))) {
    git init | Out-Null
    Write-Host 'git init: created .git'
} else {
    Write-Host 'git init: .git already exists'
}

git config --local user.name  $name
git config --local user.email $email
# Avoid CRLF churn on Windows when paired with editors on Linux/Mac.
git config --local core.autocrlf false
Write-Host ("local config set: user.name={0}, user.email={1}" -f $name, $email)

# 3. Use 'main' as the default branch (matches the GitHub remote).
git symbolic-ref HEAD refs/heads/main | Out-Null

# 4. Stage everything. .gitignore keeps .env, node_modules, .next, dev.db out.
git add .
Write-Host ''
Write-Host '=== git status (will-be commit) ==='
git status --short

# 5. First commit.
git commit -m 'Initial commit: RUTHEX LMS foundation (Next.js 14 + Prisma + SQLite)

- 21-model Prisma schema (User, Branch, Borrower, LoanProduct, Loan, Repayment, AML, BOZ reports)
- Auth (JWT + bcrypt) and 7-role RBAC
- Loan lifecycle: application, multi-level approval, disbursement, repayment (FIFO), restructure, write-off
- AML/CFT engine: CTR auto-flag + 5 STR pattern detectors
- BOZ reports: capital adequacy (15% MFI floor), liquidity, asset quality with IFRS 9 staging, large exposures, related-party
- Audit log with SHA-256 hash chain and integrity verifier on Settings page
- Public apply portal + USSD endpoint + mobile money webhook (mock adapter)
- Admin console: users, loan products, branches; audit log viewer
- RUTHEX brand: green #0B5D3B / emerald / gold #D4AF37 palette, custom logo component, PWA icons' | Out-Null
Write-Host ''
Write-Host '=== last commit ==='
git log --oneline -1

# 6. Add the GitHub remote.
$existing = git remote get-url origin 2>$null
if (-not $existing) {
    git remote add origin $remote
    Write-Host ("remote added: origin -> {0}" -f $remote)
} else {
    Write-Host ("remote already set: origin -> {0}" -f $existing)
}

Write-Host ''
Write-Host '=== ready for push ==='
Write-Host 'Next: gh auth login --web (interactive, opens browser)'
Write-Host 'Then: git push -u origin main'
