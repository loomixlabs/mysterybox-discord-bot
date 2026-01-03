# Script PowerShell pour exécuter la migration traps_blocked
Write-Host "🛡️ MIGRATION: Ajout tracking pièges bloqués" -ForegroundColor Cyan
Write-Host "=" * 80

# Chemins
$migrationFile = Join-Path $PSScriptRoot "..\database\migrations\add-traps-blocked-tracking.sql"
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

# Vérifier que le fichier SQL existe
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Fichier SQL de migration trouvé" -ForegroundColor Green
Write-Host ""

# Lire et afficher le contenu SQL
$sqlContent = Get-Content $migrationFile -Raw
Write-Host "SQL à exécuter:" -ForegroundColor Yellow
Write-Host $sqlContent
Write-Host ""
Write-Host "=" * 80
Write-Host ""

# Exécuter la migration
Write-Host "🔄 Exécution de la migration..." -ForegroundColor Cyan
$env:PGPASSWORD = "Discord2025IA@Bot"

try {
    & $psqlPath -U botuser -d botdb -f $migrationFile 2>&1 | ForEach-Object {
        Write-Host $_ -ForegroundColor White
    }

    Write-Host ""
    Write-Host "✅ Migration exécutée!" -ForegroundColor Green
    Write-Host ""

    # Vérifier que la colonne existe
    Write-Host "🔍 Vérification de la colonne ajoutée:" -ForegroundColor Cyan
    $checkQuery = @"
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'players' AND column_name = 'traps_blocked';
"@

    & $psqlPath -U botuser -d botdb -c $checkQuery 2>&1 | ForEach-Object {
        Write-Host $_ -ForegroundColor White
    }

    Write-Host ""

    # Statistiques
    Write-Host "📊 Statistiques actuelles:" -ForegroundColor Cyan
    $statsQuery = @"
SELECT
  COUNT(*) as total_players,
  COUNT(CASE WHEN traps_blocked > 0 THEN 1 END) as players_with_blocks,
  COALESCE(MAX(traps_blocked), 0) as max_blocked
FROM players;
"@

    & $psqlPath -U botuser -d botdb -c $statsQuery 2>&1 | ForEach-Object {
        Write-Host $_ -ForegroundColor White
    }

    Write-Host ""
    Write-Host "=" * 80
    Write-Host "✅ Migration terminée avec succès!" -ForegroundColor Green

} catch {
    Write-Host "❌ Erreur lors de la migration:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD
}
