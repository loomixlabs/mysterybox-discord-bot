/**
 * Script pour ajouter guild_id à tous les appels de database
 *
 * PostgreSQL multi-serveur nécessite guild_id en premier paramètre pour toutes les fonctions
 */

const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'handlers/adminPanelHandler.js',
  'handlers/giveHandler.js',
  'handlers/mysteryBoxHandler.js',
  'handlers/missionHandler.js',
  'handlers/superBonusHandler.js',
  'handlers/campaignHandler.js',
  'commands/admin/admin-panel.js',
  'commands/player/profile.js',
  'commands/player/leaderboard.js'
];

console.log('🔧 Recherche des appels db.* sans guild_id\n');

for (const file of filesToCheck) {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé: ${file}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let foundIssues = false;

  lines.forEach((line, index) => {
    // Chercher les appels db.* qui ne contiennent pas déjà guildId
    if (line.includes('db.') && line.includes('await db.')) {
      // Extraire le nom de la fonction
      const match = line.match(/await db\.(\w+)\(/);
      if (match) {
        const functionName = match[1];

        // Ignorer certaines fonctions qui ne nécessitent pas guild_id
        const noGuildIdFunctions = ['query', 'queryOne', 'queryAll', 'connect', 'disconnect'];
        if (noGuildIdFunctions.includes(functionName)) {
          return;
        }

        // Vérifier si guildId est déjà dans l'appel
        if (!line.includes('guildId') && !line.includes('guild_id')) {
          if (!foundIssues) {
            console.log(`📁 ${file}:`);
            foundIssues = true;
          }
          console.log(`   Ligne ${index + 1}: db.${functionName}() - MANQUE guild_id`);
        }
      }
    }
  });

  if (foundIssues) {
    console.log('');
  }
}

console.log('\n⚠️  ATTENTION: Ces appels doivent être corrigés manuellement');
console.log('   Ajouter interaction.guildId ou interaction.guild.id comme premier paramètre');
console.log('\nExemple:');
console.log('   Avant: const theme = await db.getActiveTheme();');
console.log('   Après: const theme = await db.getActiveTheme(interaction.guildId);');
