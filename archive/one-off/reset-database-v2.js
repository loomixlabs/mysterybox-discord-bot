const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('⚠️  ATTENTION : Vous allez RÉINITIALISER la base de données !');
console.log('📦 Sauvegarde de l\'ancienne BDD...\n');

// Sauvegarder l'ancienne BDD
const dbPath = path.join(__dirname, 'bot.db');
const backupPath = path.join(__dirname, `bot.db.backup.${Date.now()}`);

if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Sauvegarde créée : ${backupPath}\n`);

  // Supprimer l'ancienne
  fs.unlinkSync(dbPath);
  console.log('🗑️  Ancienne BDD supprimée\n');
}

// Créer la nouvelle base de données
const db = new Database(dbPath);

console.log('📦 Création de la nouvelle base de données V2...\n');

try {
  // Lire le nouveau schéma
  const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema-v2-sqlite.sql'), 'utf8');

  // Exécuter le schéma
  db.exec(schema);

  console.log('✅ Base de données V2 créée avec succès !\n');

  // Vérifier les données
  const themes = db.prepare('SELECT * FROM themes').all();
  const config = db.prepare('SELECT * FROM theme_config').all();
  const messages = db.prepare('SELECT * FROM theme_messages').all();

  console.log('📊 Vérification :');
  console.log(`   - Thèmes : ${themes.length}`);
  console.log(`   - Configurations : ${config.length}`);
  console.log(`   - Messages : ${messages.length}\n`);

  if (themes.length > 0) {
    console.log('🎯 Thème par défaut :');
    console.log(`   - Nom : ${themes[0].name}`);
    console.log(`   - ID : ${themes[0].theme_id}`);
    console.log(`   - Items requis : ${themes[0].required_items}\n`);
  }

  if (config.length > 0) {
    console.log('⚙️  Configuration par défaut :');
    console.log(`   - Collectibles : ${config[0].probability_collectible}%`);
    console.log(`   - Missions : ${config[0].probability_mission}%`);
    console.log(`   - Pièges : ${config[0].probability_trap}%\n`);
  }

  db.close();

  console.log('🎉 Migration terminée !');
  console.log('');
  console.log('📝 Prochaines étapes :');
  console.log('   1. Ajouter des collectibles : node add-test-collectibles.js');
  console.log('   2. Redémarrer le bot : npm start');
  console.log('   3. Tester sur Discord !\n');

} catch (error) {
  console.error('🔴 Erreur lors de la migration:', error);

  // Restaurer la sauvegarde en cas d'erreur
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, dbPath);
    console.log('♻️  Sauvegarde restaurée');
  }

  process.exit(1);
}
