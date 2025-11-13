@echo off
set PGPASSWORD=Discord2025IA@Bot
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U botuser -d botdb -c "ALTER TABLE themes ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP DEFAULT NULL;"
echo Migration terminee
