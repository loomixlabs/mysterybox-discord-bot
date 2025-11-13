const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'bot.db');

console.log('📦 Migration: Ajout des tables campaigns...\n');

try {
  // Ouvrir la base de données
  const db = new Database(DB_PATH);

  // Lire le fichier SQL
  const sqlPath = path.join(__dirname, '..', 'database', 'add-campaigns-tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Exécuter le SQL
  db.exec(sql);

  console.log('✅ Tables campaigns et campaign_launches créées avec succès !');

  // Vérifier que les tables existent
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name IN ('campaigns', 'campaign_launches')
    ORDER BY name
  `).all();

  console.log('\n📋 Tables créées:');
  tables.forEach(t => console.log(`  - ${t.name}`));

  db.close();
  console.log('\n✅ Migration terminée avec succès !');

} catch (error) {
  console.error('❌ Erreur lors de la migration:', error.message);
  process.exit(1);
}
