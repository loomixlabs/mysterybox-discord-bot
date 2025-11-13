const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'bot.db');
const sqlPath = path.join(__dirname, '..', 'database', 'add-announcement-templates.sql');

console.log('🔧 Migration: Ajout des templates d\'annonces personnalisables\n');

// Vérifier que la DB existe
if (!fs.existsSync(dbPath)) {
  console.error('❌ Fichier bot.db introuvable:', dbPath);
  process.exit(1);
}

// Ouvrir la connexion
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

try {
  // Lire le fichier SQL
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Exécuter la migration dans une transaction
  db.exec('BEGIN TRANSACTION');

  console.log('📝 Exécution du script SQL...');
  db.exec(sql);

  db.exec('COMMIT');

  console.log('✅ Table announcement_templates créée');
  console.log('✅ Templates par défaut insérés pour les 6 types d\'annonces');

  console.log('\n✅ Migration terminée avec succès !');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Erreur lors de la migration:', error.message);
  process.exit(1);
} finally {
  db.close();
}
