const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'bot.db');
const sqlPath = path.join(__dirname, '..', 'database', 'add-announcement-channel.sql');

console.log('🔧 Migration: Ajout du système d\'annonces\n');

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

  // Vérifier que les tables existent
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name IN ('announcement_channel', 'announcement_settings')
  `).all();

  if (tables.length !== 2) {
    throw new Error('Les tables n\'ont pas été créées correctement');
  }

  db.exec('COMMIT');

  console.log('✅ Table announcement_channel créée avec succès');
  console.log('✅ Table announcement_settings créée avec succès');

  // Afficher la structure
  console.log('\n📊 Structure de announcement_channel:');
  const tableInfo1 = db.prepare('PRAGMA table_info(announcement_channel)').all();
  tableInfo1.forEach(col => {
    console.log(`   - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
  });

  console.log('\n📊 Structure de announcement_settings:');
  const tableInfo2 = db.prepare('PRAGMA table_info(announcement_settings)').all();
  tableInfo2.forEach(col => {
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
