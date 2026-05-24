# Register Stochos Platform Watchdog Task
# Runs the watchdog script every 5 minutes in a hidden window.

$scriptPath = "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\watchdog.ps1"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Could not find watchdog script at $scriptPath"
    exit 1
}

# Create Scheduled Task components
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$Trigger = New-ScheduledTaskTrigger -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -Once
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register the task
try {
    Register-ScheduledTask -TaskName "StochosPlatformWatchdog" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Monitors and restarts Stochos WSL2, Docker, Shiny, and RStudio services." -Force
    Write-Host "[OK] Successfully registered StochosPlatformWatchdog scheduled task to run every 5 minutes."
} catch {
    Write-Error "Failed to register scheduled task: $_"
}
