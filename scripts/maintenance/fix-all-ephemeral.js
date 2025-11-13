/**
 * Script pour remplacer TOUS les ephemeral: true/false par flags: 64/0
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'commands/admin/admin-panel.js',
  'commands/superadmin/super-admin-panel.js',
  'commands/player/my-bonuses.js',
  'events/interactionCreate.js',
  'handlers/giveHandler.js',
  'handlers/adminPanelHandler.js',
  'handlers/modalHandler.js',
  'handlers/missionHandler.js',
  'handlers/mysteryBoxHandler.js',
  'handlers/superAdminHandler.js',
  'utils/guildConfig.js'
];

console.log('🔧 Remplacement de tous les ephemeral par flags\n');

let totalReplacements = 0;

for (const file of filesToFix) {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Compter les occurrences avant
  const countBefore = (content.match(/ephemeral:\s*(true|false)/g) || []).length;

  // Remplacer ephemeral: true par flags: 64
  content = content.replace(/ephemeral:\s*true/g, 'flags: 64');

  // Remplacer ephemeral: false par flags: 0
  content = content.replace(/ephemeral:\s*false/g, 'flags: 0');

  // Remplacer { ephemeral: true } par { flags: 64 }
  content = content.replace(/\{\s*ephemeral:\s*true\s*\}/g, '{ flags: 64 }');

  // Remplacer { ephemeral: false } par { flags: 0 }
  content = content.replace(/\{\s*ephemeral:\s*false\s*\}/g, '{ flags: 0 }');

  // Compter après
  const countAfter = (content.match(/ephemeral:\s*(true|false)/g) || []).length;

  if (countBefore > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}: ${countBefore} remplacements`);
    totalReplacements += countBefore;
  } else {
    console.log(`ℹ️  ${file}: déjà à jour`);
  }
}

console.log(`\n📊 Total: ${totalReplacements} remplacements effectués`);
