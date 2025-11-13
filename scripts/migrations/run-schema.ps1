# Script pour exécuter le schéma PostgreSQL v3
$env:PGPASSWORD = "Discord2025IA@Bot"
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$schemaFile = "C:\ia mogo\bot discord\database\schema-v3-multiserver-postgresql.sql"

Write-Host "=== Exécution du schéma PostgreSQL v3 ===" -ForegroundColor Cyan
Write-Host "Fichier: $schemaFile" -ForegroundColor Yellow
Write-Host ""

& $psqlPath -U botuser -d botdb -f $schemaFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Schéma exécuté avec succès ===" -ForegroundColor Green
} else {
    Write-Host "`n=== Erreur lors de l'exécution du schéma ===" -ForegroundColor Red
    exit 1
}
