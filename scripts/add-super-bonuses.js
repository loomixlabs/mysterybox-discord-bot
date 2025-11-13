const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'bot.db');
const sqlPath = path.join(__dirname, '..', 'database', 'add-super-bonuses.sql');

console.log('🎁 MIGRATION: Système Super Bonus\n');
console.log(`📂 Base de données: ${dbPath}`);
console.log(`📄 Fichier SQL: ${sqlPath}\n`);

try {
  // Vérifier que le fichier SQL existe
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`❌ Fichier SQL introuvable: ${sqlPath}`);
  }

  // Ouvrir la base de données
  const db = new Database(dbPath);
  console.log('✅ Connexion à la base de données réussie\n');

  // Lire le fichier SQL
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('✅ Fichier SQL chargé\n');

  // Exécuter le SQL
  console.log('⏳ Exécution des migrations...\n');
  db.exec(sql);

  // Vérifier que les tables ont été créées
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name IN ('super_bonuses', 'player_active_bonuses', 'bonus_usage_history')
    ORDER BY name
  `).all();

  console.log('✅ Tables créées:');
  tables.forEach(table => {
    console.log(`   📦 ${table.name}`);
  });

  // Compter les bonus par défaut insérés
  const bonusCount = db.prepare('SELECT COUNT(*) as count FROM super_bonuses').get();
  console.log(`\n✅ Super bonus par défaut insérés: ${bonusCount.count}`);

  // Afficher les bonus créés
  console.log('\n🎁 Liste des Super Bonus:');
  const bonuses = db.prepare(`
    SELECT bonus_id, name, icon, rarity, duration_type,
           CASE duration_type
             WHEN 'temporary' THEN duration_value || 's'
             WHEN 'charges' THEN duration_value || ' charges'
             WHEN 'permanent' THEN 'permanent'
           END as duration
    FROM super_bonuses
    ORDER BY
      CASE rarity
        WHEN 'legendary' THEN 1
        WHEN 'epic' THEN 2
        WHEN 'rare' THEN 3
        WHEN 'common' THEN 4
      END,
      name
  `).all();

  bonuses.forEach(bonus => {
    const rarityColor = {
      legendary: '🌟',
      epic: '💜',
      rare: '💙',
      common: '⚪'
    }[bonus.rarity];

    console.log(`   ${rarityColor} [${bonus.rarity.toUpperCase()}] ${bonus.icon} ${bonus.name} (${bonus.duration})`);
  });

  // Afficher les index créés
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='index' AND name LIKE 'idx_%bonus%'
    ORDER BY name
  `).all();

  if (indexes.length > 0) {
    console.log(`\n✅ Index créés: ${indexes.length}`);
    indexes.forEach(idx => {
      console.log(`   🔍 ${idx.name}`);
    });
  }

  db.close();
  console.log('\n✅ Migration terminée avec succès! 🎉\n');

} catch (error) {
  console.error('\n❌ Erreur lors de la migration:', error.message);
  console.error(error.stack);
  process.exit(1);
}
