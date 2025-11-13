/**
 * Script de correction automatique pour missionHandler.js
 * - Ajoute interaction.guildId à tous les appels db.*
 * - Ajoute deferUpdate() immédiatement dans les handlers
 * - Remplace datetime('now') par NOW() pour PostgreSQL
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'handlers/missionHandler.js');
let content = fs.readFileSync(filePath, 'utf8');
let modificationsCount = 0;

console.log('🔧 Correction de missionHandler.js...\n');

// 1. Correction SQL: datetime('now') → NOW()
console.log('📝 Remplacement datetime(\'now\') → NOW()...');
const datetimeMatches = (content.match(/datetime\('now'\)/g) || []).length;
if (datetimeMatches > 0) {
  content = content.replace(/datetime\('now'\)/g, 'NOW()');
  console.log(`✅ ${datetimeMatches} occurrence(s) datetime() corrigée(s)`);
  modificationsCount += datetimeMatches;
}

// 2. Corrections guild_id dans les appels db.*
const corrections = [
  // handleMissionStart() - lignes 27, 37, 38
  {
    find: /const mission = await db\.getMissionById\(parseInt\(missionId\)\);/g,
    replace: 'const mission = await db.getMissionById(interaction.guildId, parseInt(missionId));',
    description: 'getMissionById avec guild_id'
  },
  {
    find: /const player = await db\.getPlayerByDiscordId\(interaction\.user\.id\);/g,
    replace: 'const player = await db.getPlayerByDiscordId(interaction.guildId, interaction.user.id);',
    description: 'getPlayerByDiscordId avec guild_id'
  },
  {
    find: /const progress = await db\.getActiveMissionProgress\(player\.id, mission\.id\);/g,
    replace: 'const progress = await db.getActiveMissionProgress(interaction.guildId, player.id, mission.id);',
    description: 'getActiveMissionProgress avec guild_id'
  },

  // completeMission() - lignes 419, 430, 434, 435
  {
    find: /const randomCollectible = await db\.getRandomCollectible\(mission\.theme_id\);/g,
    replace: 'const randomCollectible = await db.getRandomCollectible(interaction.guildId, mission.theme_id);',
    description: 'getRandomCollectible avec guild_id'
  },
  {
    find: /const alreadyHas = await db\.hasCollectible\(player\.id, randomCollectible\.id\);/g,
    replace: 'const alreadyHas = await db.hasCollectible(interaction.guildId, player.id, randomCollectible.id);',
    description: 'hasCollectible avec guild_id (dans completeMission)'
  },
  {
    find: /await db\.addCollectible\(player\.id, randomCollectible\.id\);(\s*)const playerProgress = await db\.incrementProgress\(player\.id, mission\.theme_id\);/gs,
    replace: 'await db.addCollectible(interaction.guildId, player.id, randomCollectible.id);$1const playerProgress = await db.incrementProgress(interaction.guildId, player.id, mission.theme_id);',
    description: 'addCollectible + incrementProgress avec guild_id'
  },

  // handleCollectionComplete() - ligne 492
  {
    find: /await db\.completeCollection\(player\.id, theme\.id\);/g,
    replace: 'await db.completeCollection(interaction.guildId, player.id, theme.id);',
    description: 'completeCollection avec guild_id'
  },

  // approveMission() - lignes 568-576
  {
    find: /const randomCollectible = await db\.getRandomCollectible\(progressData\.theme_id\);(\s*)const player = await db\.getPlayerByDiscordId\(progressData\.discord_id\);/gs,
    replace: 'const randomCollectible = await db.getRandomCollectible(progressData.guild_id, progressData.theme_id);$1const player = await db.getPlayerByDiscordId(progressData.guild_id, progressData.discord_id);',
    description: 'getRandomCollectible + getPlayerByDiscordId dans approveMission avec guild_id'
  },
  {
    find: /const alreadyHas = await db\.hasCollectible\(player\.id, randomCollectible\.id\);(\s*)if \(!alreadyHas\) \{(\s*)await db\.addCollectible\(player\.id, randomCollectible\.id\);/gs,
    replace: 'const alreadyHas = await db.hasCollectible(progressData.guild_id, player.id, randomCollectible.id);$1if (!alreadyHas) {$2await db.addCollectible(progressData.guild_id, player.id, randomCollectible.id);',
    description: 'hasCollectible + addCollectible dans approveMission avec guild_id'
  },

  // Ajouter guild_id dans les UPDATE queries
  {
    find: /UPDATE mission_progress(\s*)SET (.*?)(\s*)WHERE id = \$/gs,
    replace: 'UPDATE mission_progress$1SET $2,$3guild_id = (SELECT guild_id FROM mission_progress WHERE id = $',
    description: 'UPDATE mission_progress avec guild_id dans WHERE'
  }
];

// Appliquer toutes les corrections
corrections.forEach(({ find, replace, description }) => {
  const matches = content.match(find);
  if (matches) {
    content = content.replace(find, replace);
    modificationsCount += matches.length;
    console.log(`✅ ${description} (${matches.length} occurrence(s))`);
  } else {
    console.log(`ℹ️  ${description} - Déjà corrigé ou non trouvé`);
  }
});

// 3. Ajouter deferUpdate() au début des handlers
console.log('\n📝 Ajout deferUpdate() dans les handlers...');

// handleMissionStart
if (content.includes('async handleMissionStart(interaction) {') &&
    !content.includes('handleMissionStart(interaction) {\n    await interaction.deferUpdate();')) {
  content = content.replace(
    /(async handleMissionStart\(interaction\) \{)/,
    '$1\n    await interaction.deferUpdate();'
  );
  console.log('✅ deferUpdate() ajouté dans handleMissionStart');
  modificationsCount++;
}

// handleMissionSubmit
if (content.includes('async handleMissionSubmit(interaction) {') &&
    !content.includes('handleMissionSubmit(interaction) {\n    await interaction.deferUpdate();')) {
  content = content.replace(
    /(async handleMissionSubmit\(interaction\) \{)/,
    '$1\n    await interaction.deferUpdate();'
  );
  console.log('✅ deferUpdate() ajouté dans handleMissionSubmit');
  modificationsCount++;
}

// Sauvegarder
fs.writeFileSync(filePath, content, 'utf8');

console.log(`\n📊 Total: ${modificationsCount} modification(s) effectuée(s)`);
console.log('✅ missionHandler.js corrigé !');
