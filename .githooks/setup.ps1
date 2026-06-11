# Setup script to install Git hooks on Windows
# Run this once per developer workstation

$HOOKS_DIR = ".githooks"
$GIT_HOOKS_DIR = ".git/hooks"

Write-Host " Setting up Git hooks for client-hub-backend..." -ForegroundColor Green

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not in a git repository" -ForegroundColor Red
    exit 1
}

# Configure Git to use .githooks directory
Write-Host "📝 Configuring Git to use $HOOKS_DIR directory..." -ForegroundColor Yellow
git config core.hooksPath "$HOOKS_DIR"

Write-Host ""
Write-Host "✅ Git hooks setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Installed hooks:" -ForegroundColor Cyan
Write-Host "  - pre-commit: Prevents committing sensitive files"
Write-Host ""
Write-Host "To test the hook, try:" -ForegroundColor Yellow
Write-Host "  echo 'test' > test.env"
Write-Host "  git add test.env"
Write-Host "  git commit -m 'test'  # Should be blocked"
Write-Host ""
Write-Host "Note: Hooks will run in Git Bash. Make sure Git Bash is installed." -ForegroundColor Yellow
