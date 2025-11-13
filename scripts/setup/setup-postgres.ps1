# Script de configuration PostgreSQL pour le bot Discord
$env:PGPASSWORD = "Discord2025IA@"
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "=== Création de l'utilisateur botuser ===" -ForegroundColor Cyan

# Créer l'utilisateur et la base de données
& $psqlPath -U postgres -c "CREATE USER botuser WITH PASSWORD 'Discord2025IA@Bot';"
& $psqlPath -U postgres -c "ALTER USER botuser CREATEDB;"
& $psqlPath -U postgres -c "CREATE DATABASE botdb OWNER botuser;"
& $psqlPath -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE botdb TO botuser;"

Write-Host "`n=== Base de données créée avec succès ===" -ForegroundColor Green
Write-Host "Utilisateur: botuser"
Write-Host "Base de données: botdb"
Write-Host "Mot de passe: Discord2025IA@Bot"
