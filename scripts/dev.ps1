$ErrorActionPreference = "Stop"

Write-Host "Starting Fabricgamma Phase 1 development services..."
Write-Host "This script starts local foreground processes in separate PowerShell windows."

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; corepack pnpm --filter @fabrica/web dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; python scripts/run_uv.py run --package fabrica-api uvicorn fabrica_api.main:app --reload --host 127.0.0.1 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; python scripts/run_uv.py run --package fabrica-cad uvicorn fabrica_cad.main:app --reload --host 127.0.0.1 --port 8001"
