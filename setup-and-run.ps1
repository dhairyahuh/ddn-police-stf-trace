# SancharNetra Setup and Run Script (Windows)
Param(
  [switch]$SkipInstall = $false
)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   SancharNetra Portal - Windows Startup" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# 1. Start MongoDB
Write-Host "[1/4] Ensuring MongoDB Service is running..." -ForegroundColor Yellow
try {
    Start-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    Write-Host "   MongoDB Service command checked." -ForegroundColor Green
} catch {
    Write-Host "   Note: Ensure MongoDB is installed and running" -ForegroundColor Gray
}

# 2. Install Dependencies
if (-Not $SkipInstall) {
    Write-Host "[2/4] Installing Backend Dependencies..." -ForegroundColor Yellow
    Set-Location -Path "server"
    npm install
    Set-Location -Path ".."

    Write-Host "[3/4] Installing Frontend Dependencies..." -ForegroundColor Yellow
    Set-Location -Path "client"
    npm install
    Set-Location -Path ".."
} else {
    Write-Host "Skipping Dependency Installation (-SkipInstall flagged)..." -ForegroundColor Yellow
}

# 3. Booting Application
Write-Host "[4/4] Starting the Application Servers (Backend & Frontend)..." -ForegroundColor Yellow

# Start Backend quietly in background
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd server && npm start" -WindowStyle Minimized

# Start Frontend quietly in background (will pop open Browser)
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd client && npm start" -WindowStyle Minimized

Write-Host "===============================================" -ForegroundColor Green
Write-Host "✅ Boot sequence initiated!" -ForegroundColor Green
Write-Host "The Backend is warming up on Port 8080." -ForegroundColor Cyan
Write-Host "The Frontend is opening http://localhost:3000 automatically." -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Green
Read-Host "Press Enter to exit..."
