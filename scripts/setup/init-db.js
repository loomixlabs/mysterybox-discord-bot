const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Créer la base de données
const db = new Database('bot.db');

console.log('📦 Initialisation de la base de données SQLite...');

try {
  // Lire le schéma
  const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema-sqlite.sql'), 'utf8');

  // Exécuter le schéma
  db.exec(schema);

  console.log('✅ Base de données initialisée avec succès !');
  console.log('');

  // Vérifier les données
  const themes = db.prepare('SELECT * FROM themes').all();
  const messages = db.prepare('SELECT * FROM theme_messages').all();

  console.log(`📊 Thèmes créés: ${themes.length}`);
  themes.forEach(theme => {
    console.log(`  - ${theme.name} (${theme.theme_id})`);
  });

  console.log(`📝 Messages créés: ${messages.length}`);

  db.close();
  console.log('');
  console.log('🎉 Prêt à lancer le bot !');

} catch (error) {
  console.error('🔴 Erreur lors de l\'initialisation:', error);
  process.exit(1);
}
