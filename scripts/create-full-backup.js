/**
 * Script: Créer un backup complet de la base de données
 * Utilise pg_dump via Node.js child_process
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, '..', 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
const backupFile = path.join(backupDir, `backup_complete_${timestamp}.sql`);

console.log('💾 CRÉATION BACKUP COMPLET\n');
console.log('='.repeat(60));

// Créer le dossier backups si nécessaire
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Créer le backup avec pg_dump
const pgDumpPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
const cmd = `"${pgDumpPath}" -U botuser -d botdb -f "${backupFile}"`;

console.log(`📂 Fichier: ${backupFile}`);
console.log('⏳ Création en cours...\n');

try {
  execSync(cmd, {
    env: { ...process.env, PGPASSWORD: 'Discord2025IA@Bot' },
    stdio: 'pipe'
  });

  // Vérifier le fichier créé
  const stats = fs.statSync(backupFile);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`✅ Backup créé avec succès!`);
  console.log(`   📁 Taille: ${sizeMB} MB`);
  console.log(`   📅 Date: ${new Date().toLocaleString('fr-FR')}`);

  // Lire les premières lignes pour vérifier
  const content = fs.readFileSync(backupFile, 'utf8');
  const lines = content.split('\n');
  const tableCount = lines.filter(l => l.startsWith('CREATE TABLE')).length;

  console.log(`   📊 Tables: ~${tableCount}`);
  console.log(`   📝 Lignes totales: ${lines.length}`);

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Backup sauvegardé: ${path.basename(backupFile)}`);

} catch (err) {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
}
