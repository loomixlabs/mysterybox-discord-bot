/**
 * Script: Restaurer un backup de la base de données
 * Usage: node scripts/restore-backup.js <nom_du_backup>
 *
 * Exemple: node scripts/restore-backup.js backup_complete_2025-11-30T12-25-54.sql
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backupName = process.argv[2];

if (!backupName) {
  console.log('❌ Usage: node scripts/restore-backup.js <nom_du_backup>');
  console.log('\n📂 Backups disponibles:');

  const backupDir = path.join(__dirname, '..', 'backups');
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .reverse();

  files.forEach(f => {
    const stats = fs.statSync(path.join(backupDir, f));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const date = stats.mtime.toLocaleString('fr-FR');
    console.log(`   - ${f} (${sizeMB} MB) - ${date}`);
  });

  process.exit(1);
}

const backupFile = path.join(__dirname, '..', 'backups', backupName);

if (!fs.existsSync(backupFile)) {
  console.error(`❌ Fichier non trouvé: ${backupFile}`);
  process.exit(1);
}

console.log('🔄 RESTAURATION DU BACKUP\n');
console.log('='.repeat(60));
console.log(`📂 Fichier: ${backupName}`);

const stats = fs.statSync(backupFile);
console.log(`   Taille: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
const env = { ...process.env, PGPASSWORD: 'Discord2025IA@Bot' };

try {
  // 1. Drop et recréer le schema
  console.log('\n⚠️  Étape 1: Reset du schema...');
  execSync(`"${psqlPath}" -U botuser -d botdb -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO botuser;"`, {
    env,
    stdio: 'pipe'
  });
  console.log('   ✅ Schema reset');

  // 2. Importer le backup
  console.log('\n📥 Étape 2: Import du backup...');
  execSync(`"${psqlPath}" -U botuser -d botdb -f "${backupFile}"`, {
    env,
    stdio: 'pipe'
  });
  console.log('   ✅ Backup importé');

  // 3. Vérification
  console.log('\n🔍 Étape 3: Vérification...');
  const tablesResult = execSync(`"${psqlPath}" -U botuser -d botdb -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"`, {
    env,
    encoding: 'utf8'
  });
  console.log(`   ✅ Tables: ${tablesResult.trim()}`);

  const missionsResult = execSync(`"${psqlPath}" -U botuser -d botdb -t -c "SELECT COUNT(*) FROM missions"`, {
    env,
    encoding: 'utf8'
  });
  console.log(`   ✅ Missions: ${missionsResult.trim()}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ RESTAURATION TERMINÉE AVEC SUCCÈS!');

} catch (err) {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
}
