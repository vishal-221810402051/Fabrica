$ErrorActionPreference = "Stop"

$paths = @(
  "apps/web/dist",
  "coverage",
  "playwright-report",
  "test-results",
  ".pytest_cache",
  ".ruff_cache",
  ".mypy_cache",
  ".pyright"
)

foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}

Get-ChildItem -Path . -Recurse -Directory -Filter "__pycache__" |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
