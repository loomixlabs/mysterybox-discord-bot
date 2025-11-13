/**
 * Script de correction automatique pour giveHandler.js
 * Ajoute interaction.guildId/guildId à tous les appels db.* manquants
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'handlers/giveHandler.js');
let content = fs.readFileSync(filePath, 'utf8');
let modificationsCount = 0;

console.log('🔧 Correction de giveHandler.js...\n');

// Liste des corrections à effectuer
const corrections = [
  // createGive() - Ajouter paramètre guildId
  {
    find: /async createGive\(channel, themeId, itemType, itemId\)/,
    replace: 'async createGive(guildId, channel, themeId, itemType, itemId)',
    description: 'Ajout paramètre guildId à createGive()'
  },

  // createGive() - ligne 12 (query themes)
  {
    find: /const theme = await db\.queryOne\('SELECT \* FROM themes WHERE id = \$1', \[themeId\]\);/,
    replace: "const theme = await db.queryOne('SELECT * FROM themes WHERE id = $1 AND guild_id = $2', [themeId, guildId]);",
    description: 'Query themes avec guild_id'
  },

  // createGive() - ligne 18 (query collectibles)
  {
    find: /item = await db\.queryOne\('SELECT \* FROM collectibles WHERE id = \$1', \[itemId\]\);/,
    replace: "item = await db.queryOne('SELECT * FROM collectibles WHERE id = $1 AND guild_id = $2', [itemId, guildId]);",
    description: 'Query collectibles avec guild_id'
  },

  // createGive() - ligne 20 (query traps)
  {
    find: /item = await db\.queryOne\('SELECT \* FROM traps WHERE id = \$1', \[itemId\]\);/,
    replace: "item = await db.queryOne('SELECT * FROM traps WHERE id = $1 AND guild_id = $2', [itemId, guildId]);",
    description: 'Query traps avec guild_id'
  },

  // createGive() - ligne 26 (getThemeMessages)
  {
    find: /const messages = await db\.getThemeMessages\(theme\.id\);/,
    replace: 'const messages = await db.getThemeMessages(guildId, theme.id);',
    description: 'getThemeMessages avec guild_id (ligne 26)'
  },

  // createGive() - ligne 51 (logGive)
  {
    find: /await db\.logGive\(itemType, item\.id, message\.id, channel\.id\);/,
    replace: 'await db.logGive(guildId, itemType, item.id, message.id, channel.id);',
    description: 'logGive avec guild_id'
  },

  // handleGiveClick() - ligne 89 (updateGiveWinner)
  {
    find: /await db\.updateGiveWinner\(\s*interaction\.message\.id,\s*userId,\s*interaction\.user\.username\s*\);/gs,
    replace: 'await db.updateGiveWinner(\n      interaction.guildId,\n      interaction.message.id,\n      userId,\n      interaction.user.username\n    );',
    description: 'updateGiveWinner avec guild_id'
  },

  // handleCollectibleWin() - ligne 126 (incrementProgress sans guild_id)
  {
    find: /const progress = await db\.incrementProgress\(player\.id, collectible\.theme_id\);/,
    replace: 'const progress = await db.incrementProgress(interaction.guildId, player.id, collectible.theme_id);',
    description: 'incrementProgress avec guild_id'
  },

  // handleCollectibleWin() - ligne 129 (getThemeMessages)
  {
    find: /const messages = await db\.getThemeMessages\(collectible\.theme_id\);/,
    replace: 'const messages = await db.getThemeMessages(interaction.guildId, collectible.theme_id);',
    description: 'getThemeMessages avec guild_id (ligne 129)'
  },

  // sendDuplicateNotification() - ligne 176 (getThemeMessages)
  {
    find: /async sendDuplicateNotification\(interaction, collectible\) \{\s*const messages = await db\.getThemeMessages\(collectible\.theme_id\);/gs,
    replace: 'async sendDuplicateNotification(interaction, collectible) {\n    const messages = await db.getThemeMessages(interaction.guildId, collectible.theme_id);',
    description: 'getThemeMessages avec guild_id (ligne 176)'
  },

  // createMissionThread() - ligne 351-354 (INSERT mission_progress)
  {
    find: /await db\.query\(\s*`INSERT INTO mission_progress \(player_id, collectible_id, thread_id, status, created_at\)\s*VALUES \(\$1, \$2, \$3, 'pending', NOW\(\)\)`,\s*\[player\.id, collectible\.id, thread\.id\]\s*\);/gs,
    replace: "await db.query(\n        `INSERT INTO mission_progress (guild_id, player_id, collectible_id, thread_id, status, created_at)\n         VALUES ($1, $2, $3, $4, 'pending', NOW())`,\n        [interaction.guildId, player.id, collectible.id, thread.id]\n      );",
    description: 'INSERT mission_progress avec guild_id'
  },

  // handleCollectionComplete() - ligne 379 (completeCollection)
  {
    find: /await db\.completeCollection\(player\.id, collectible\.theme_id\);/,
    replace: 'await db.completeCollection(interaction.guildId, player.id, collectible.theme_id);',
    description: 'completeCollection avec guild_id'
  },

  // handleCollectionComplete() - ligne 389 (getThemeMessages)
  {
    find: /const messages = await db\.getThemeMessages\(collectible\.theme_id\);([\s\S]{0,300}const completeMsg)/,
    replace: 'const messages = await db.getThemeMessages(interaction.guildId, collectible.theme_id);$1',
    description: 'getThemeMessages avec guild_id (ligne 389)'
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

// Sauvegarder
fs.writeFileSync(filePath, content, 'utf8');

console.log(`\n📊 Total: ${modificationsCount} modification(s) effectuée(s)`);
console.log('✅ giveHandler.js corrigé !');
