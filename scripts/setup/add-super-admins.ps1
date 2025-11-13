# Script pour ajouter les super-admins
$env:PGPASSWORD = "Discord2025IA@Bot"
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$sqlFile = "C:\ia mogo\bot discord\add-super-admins.sql"

Write-Host "=== Ajout des super-admins ===" -ForegroundColor Cyan
Write-Host "ID 1: 297307186307006464 (Propriétaire)" -ForegroundColor Yellow
Write-Host "ID 2: 340981911281205248 (Associé)" -ForegroundColor Yellow
Write-Host ""

& $psqlPath -U botuser -d botdb -f $sqlFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Super-admins ajoutés avec succès ===" -ForegroundColor Green
} else {
    Write-Host "`n=== Erreur lors de l'ajout ===" -ForegroundColor Red
    exit 1
}
