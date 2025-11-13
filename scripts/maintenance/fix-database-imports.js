/**
 * Script pour remplacer tous les imports database.js par database-pg.js
 */

const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'commands/player/profile.js',
  'commands/player/leaderboard.js',
  'commands/admin/admin-panel.js',
  'handlers/campaignHandler.js',
  'handlers/adminPanelHandler.js',
  'handlers/missionHandler.js',
  'handlers/superBonusHandler.js',
  'handlers/giveHandler.js',
  'handlers/mysteryBoxHandler.js',
  'handlers/modalHandler.js',
  'handlers/superAdminHandler.js',
  'utils/guildConfig.js',
  'utils/announcements.js'
];

console.log('🔧 Remplacement des imports database.js → database-pg.js\n');

let successCount = 0;
let errorCount = 0;

for (const file of filesToUpdate) {
  const filePath = path.join(__dirname, file);

  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Fichier non trouvé: ${file}`);
      errorCount++;
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Remplacer les différents patterns d'import
    const patterns = [
      { from: "require('../utils/database')", to: "require('../utils/database-pg')" },
      { from: "require('../../utils/database')", to: "require('../../utils/database-pg')" },
      { from: "require('./database')", to: "require('./database-pg')" }
    ];

    let modified = false;
    for (const pattern of patterns) {
      if (content.includes(pattern.from)) {
        content = content.replace(pattern.from, pattern.to);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${file}`);
      successCount++;
    } else {
      console.log(`ℹ️  ${file} (déjà à jour)`);
    }
  } catch (error) {
    console.log(`❌ Erreur avec ${file}: ${error.message}`);
    errorCount++;
  }
}

console.log(`\n📊 Résumé:`);
console.log(`   ✅ Modifiés: ${successCount}`);
console.log(`   ❌ Erreurs: ${errorCount}`);
console.log(`   📁 Total: ${filesToUpdate.length}`);
