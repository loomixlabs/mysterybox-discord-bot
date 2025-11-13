const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'bot.db');
const sqlPath = path.join(__dirname, '..', 'database', 'add-theme-role-id.sql');

console.log('📦 Migration: Ajout de la colonne final_role_id');
console.log(`📂 Database: ${dbPath}`);

// Vérifier que la DB existe
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database non trouvée:', dbPath);
  process.exit(1);
}

// Connexion à la DB
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

try {
  // Lire le SQL
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Vérifier si la colonne existe déjà
  const tableInfo = db.prepare('PRAGMA table_info(themes)').all();
  const columnExists = tableInfo.some(col => col.name === 'final_role_id');

  if (columnExists) {
    console.log('✅ Colonne final_role_id existe déjà. Aucune action nécessaire.');
    db.close();
    process.exit(0);
  }

  // Exécuter le SQL
  db.exec(sql);

  console.log('✅ Colonne final_role_id ajoutée avec succès!');

  // Vérification
  const updatedInfo = db.prepare('PRAGMA table_info(themes)').all();
  const newColumn = updatedInfo.find(col => col.name === 'final_role_id');

  if (newColumn) {
    console.log('✅ Vérification réussie:', newColumn);
  } else {
    console.error('❌ Erreur: La colonne n\'a pas été ajoutée correctement');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Erreur lors de la migration:', error);
  process.exit(1);
} finally {
  db.close();
}
