# note-taker-cli.ps1
# CLI for managing Notes Sync Docker services

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$ComposeFile = "docker-compose.yml"

# Check if docker-compose or docker compose is available
function Test-Command {
    param([string]$Name)
    return (Get-Command $Name -ErrorAction SilentlyContinue) -ne $null
}

if (Test-Command "docker-compose") {
    $DockerCompose = "docker-compose"
} elseif (Test-Command "docker") {
    $DockerCompose = "docker compose"
} else {
    Write-Error "❌ Neither 'docker-compose' nor 'docker compose' is installed or available."
    exit 1
}

# Check if compose file exists
if (!(Test-Path $ComposeFile)) {
    Write-Error "❌ $ComposeFile not found! Make sure you're in the correct directory."
    exit 1
}

# Main switch
switch ($Command.ToLower()) {
    "up" {
        Write-Host "🚀 Starting Notes Sync services..." -ForegroundColor Green
        Invoke-Expression "$DockerCompose -f `"$ComposeFile`" up -d"
        Write-Host "✅ Services are running." -ForegroundColor Green
        Write-Host "API: http://localhost:42060" -ForegroundColor Cyan
        Write-Host "Web: http://localhost:42061" -ForegroundColor Cyan
    }

    "down" {
        Write-Host "🛑 Stopping Notes Sync services..." -ForegroundColor Yellow
        Invoke-Expression "$DockerCompose -f `"$ComposeFile`" down"
        Write-Host "✅ Services stopped." -ForegroundColor Green
    }

    "logs" {
        Write-Host "📜 Showing logs (press Ctrl+C to exit)..." -ForegroundColor Cyan
        Invoke-Expression "$DockerCompose -f `"$ComposeFile`" logs -f"
    }

    "restart" {
        Write-Host "🔄 Restarting services..." -ForegroundColor Yellow
        Invoke-Expression "$DockerCompose -f `"$ComposeFile`" restart"
        Write-Host "✅ Restarted." -ForegroundColor Green
    }

    "status" {
        Write-Host "📊 Service status:" -ForegroundColor Cyan
        Invoke-Expression "$DockerCompose -f `"$ComposeFile`" ps"
    }

    "help" {
        Write-Host "Usage: note-taker-cli.ps1 [command]" -ForegroundColor White
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor White
        Write-Host "  up        Start the services" -ForegroundColor White
        Write-Host "  down      Stop and remove the services" -ForegroundColor White
        Write-Host "  logs      Show logs" -ForegroundColor White
        Write-Host "  restart   Restart the services" -ForegroundColor White
        Write-Host "  status    Show service status" -ForegroundColor White
        Write-Host "  help      Show this help message" -ForegroundColor White
        Write-Host ""
    }

    default {
        Write-Error "Unknown command: $Command"
        Write-Host "Use 'help' to see available commands."
        exit 1
    }
}