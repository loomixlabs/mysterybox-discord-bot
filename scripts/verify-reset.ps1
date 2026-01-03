# Verification post-reset

$env:PGPASSWORD = "Discord2025IA@Bot"
$guildId = "1248028543389143070"

Write-Host "Verification des donnees APRES reinitialisation" -ForegroundColor Cyan
Write-Host ""

# Verifier les tables joueurs (doivent etre vides)
Write-Host "Tables joueurs (doivent etre a 0):" -ForegroundColor Yellow

$queries = @(
    "SELECT COUNT(*) FROM players WHERE guild_id = '$guildId'",
    "SELECT COUNT(*) FROM collections WHERE guild_id = '$guildId'",
    "SELECT COUNT(*) FROM player_progress WHERE guild_id = '$guildId'",
    "SELECT COUNT(*) FROM mission_progress WHERE guild_id = '$guildId'",
    "SELECT COUNT(*) FROM give_logs WHERE guild_id = '$guildId'",
    "SELECT COUNT(*) FROM audit_logs WHERE guild_id = '$guildId'",
    "SELECT COUNT(*) FROM give_campaigns WHERE guild_id = '$guildId'"
)

$tables = @("players", "collections", "player_progress", "mission_progress", "give_logs", "audit_logs", "give_campaigns")

for ($i = 0; $i -lt $queries.Length; $i++) {
    $result = & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U botuser -d botdb -t -A -c $queries[$i]
    $tableName = $tables[$i].PadRight(20)
    if ($result -eq "0") {
        Write-Host "  $tableName : $result" -ForegroundColor Green
    } else {
        Write-Host "  $tableName : $result" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Configuration preservee (doivent etre > 0):" -ForegroundColor Yellow

$configQueries = @(
    @{name="collectibles"; query="SELECT COUNT(*) FROM collectibles WHERE guild_id = '$guildId'"},
    @{name="themes"; query="SELECT COUNT(*) FROM themes WHERE guild_id = '$guildId'"},
    @{name="missions"; query="SELECT COUNT(*) FROM missions WHERE guild_id = '$guildId'"},
    @{name="traps"; query="SELECT COUNT(*) FROM traps WHERE guild_id = '$guildId'"}
)

foreach ($item in $configQueries) {
    $result = & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U botuser -d botdb -t -A -c $item.query
    $name = $item.name.PadRight(20)
    if ($result -gt 0) {
        Write-Host "  $name : $result" -ForegroundColor Green
    } else {
        Write-Host "  $name : $result" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Verification terminee !" -ForegroundColor Green
