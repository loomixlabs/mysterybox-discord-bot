# Script de backup avant reinitialisation
# Date: 13 novembre 2025

$env:PGPASSWORD = "Discord2025IA@Bot"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "C:\ia mogo\bot discord\backups"
$backupFile = "$backupDir\backup_before_reset_$timestamp.sql"

Write-Host "Creation du backup..." -ForegroundColor Cyan
Write-Host "Fichier: $backupFile" -ForegroundColor Yellow
Write-Host ""

& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -U botuser `
  -d botdb `
  -t players `
  -t collections `
  -t player_progress `
  -t mission_progress `
  -t give_logs `
  -t trap_triggered `
  -t apple_game_winners `
  -t player_cooldowns `
  -t audit_logs `
  -t give_campaigns `
  --file=$backupFile

if ($LASTEXITCODE -eq 0) {
    $fileSize = (Get-Item $backupFile).Length / 1KB
    Write-Host ""
    Write-Host "Backup cree avec succes !" -ForegroundColor Green
    Write-Host "Taille: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Green
    Write-Host "Fichier: $backupFile" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Erreur lors de la creation du backup" -ForegroundColor Red
    exit 1
}
