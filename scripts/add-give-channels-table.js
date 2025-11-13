const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'bot.db');
const sqlPath = path.join(__dirname, '..', 'database', 'add-give-channels-table.sql');

console.log('🔧 Migration: Ajout de la table give_channels\n');

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

  // Vérifier que la table existe
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='give_channels'
  `).get();

  if (!tableExists) {
    throw new Error('La table give_channels n\'a pas été créée');
  }

  db.exec('COMMIT');

  console.log('✅ Table give_channels créée avec succès');
  console.log('✅ Index créés avec succès');

  // Afficher la structure
  const tableInfo = db.prepare('PRAGMA table_info(give_channels)').all();
  console.log('\n📊 Structure de la table:');
  tableInfo.forEach(col => {
    console.log(`   - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
  });

  console.log('\n✅ Migration terminée avec succès !');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Erreur lors de la migration:', error.message);
  process.exit(1);
} finally {
  db.close();
}
