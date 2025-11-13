const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'bot.db');
const sqlPath = path.join(__dirname, '..', 'database', 'add-announcement-messages.sql');

console.log('🔧 Migration: Ajout des champs de messages d\'annonce\n');

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

  console.log('✅ Champ announcement_message ajouté à la table missions');
  console.log('✅ Champ announcement_message ajouté à la table traps');
  console.log('✅ Champ announcement_message ajouté à la table campaigns');

  console.log('\n✅ Migration terminée avec succès !');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Erreur lors de la migration:', error.message);
  process.exit(1);
} finally {
  db.close();
}
