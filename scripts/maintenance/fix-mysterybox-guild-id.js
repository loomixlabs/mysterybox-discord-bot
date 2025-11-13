/**
 * Script de correction automatique pour mysteryBoxHandler.js
 * Ajoute interaction.guildId à tous les appels db.* manquants
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'handlers/mysteryBoxHandler.js');
let content = fs.readFileSync(filePath, 'utf8');
let modificationsCount = 0;

console.log('🔧 Correction de mysteryBoxHandler.js...\n');

// Liste des corrections à effectuer
const corrections = [
  // revealCollectible() - ligne 213
  {
    find: /const collectible = await db\.getCollectibleById\(collectibleId\);/g,
    replace: 'const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);',
    description: 'getCollectibleById avec guild_id'
  },

  // revealCollectible() - ligne 223
  {
    find: /const alreadyHas = await db\.hasCollectible\(player\.id, collectibleId\);/g,
    replace: 'const alreadyHas = await db.hasCollectible(interaction.guildId, player.id, collectibleId);',
    description: 'hasCollectible avec guild_id'
  },

  // revealCollectible() - ligne 241
  {
    find: /await db\.addCollectible\(player\.id, collectibleId\);/g,
    replace: 'await db.addCollectible(interaction.guildId, player.id, collectibleId);',
    description: 'addCollectible avec guild_id'
  },

  // revealCollectible() - ligne 242
  {
    find: /const progress = await db\.incrementProgress\(player\.id, collectible\.theme_id\);/g,
    replace: 'const progress = await db.incrementProgress(interaction.guildId, player.id, collectible.theme_id);',
    description: 'incrementProgress avec guild_id'
  },

  // revealMission() - ligne 294
  {
    find: /const mission = await db\.getMissionById\(missionId\);/g,
    replace: 'const mission = await db.getMissionById(interaction.guildId, missionId);',
    description: 'getMissionById avec guild_id'
  },

  // revealMission() - ligne 395
  {
    find: /await db\.createMissionProgress\(player\.id, mission\.id, thread\.id\);/g,
    replace: 'await db.createMissionProgress(interaction.guildId, player.id, mission.id, thread.id);',
    description: 'createMissionProgress avec guild_id'
  },

  // revealTrap() - Query directe ligne 402
  {
    find: /const trap = await db\.queryOne\('SELECT \* FROM traps WHERE id = \$1', \[trapId\]\);/g,
    replace: "const trap = await db.queryOne('SELECT * FROM traps WHERE id = $1 AND guild_id = $2', [trapId, interaction.guildId]);",
    description: 'Query traps avec guild_id'
  },

  // revealTrap() - INSERT trap_triggered ligne 460
  {
    find: /await db\.query\(\s*'INSERT INTO trap_triggered \(player_id, trap_id\) VALUES \(\$1, \$2\)',\s*\[player\.id, trapId\]\s*\);/gs,
    replace: "await db.query(\n      'INSERT INTO trap_triggered (guild_id, player_id, trap_id) VALUES ($1, $2, $3)',\n      [interaction.guildId, player.id, trapId]\n    );",
    description: 'INSERT trap_triggered avec guild_id'
  },

  // applyTrapCooldown() - ligne 470
  {
    find: /await db\.addCooldown\(player\.id, trap\.id, trap\.cooldown_duration\);/g,
    replace: 'await db.addCooldown(interaction.guildId, player.id, trap.id, trap.cooldown_duration);',
    description: 'addCooldown avec guild_id'
  },

  // applyTrapLoseCollectible() - ligne 490
  {
    find: /const theme = await db\.getActiveTheme\(\);/g,
    replace: 'const theme = await db.getActiveTheme(interaction.guildId);',
    description: 'getActiveTheme avec guild_id'
  },

  // applyTrapLoseCollectible() - ligne 491
  {
    find: /const playerCollectibles = await db\.getPlayerCollectibles\(player\.id, theme\.id\);/g,
    replace: 'const playerCollectibles = await db.getPlayerCollectibles(interaction.guildId, player.id, theme.id);',
    description: 'getPlayerCollectibles avec guild_id'
  },

  // applyTrapMalus() - ligne 544
  {
    find: /await db\.addMalusPoints\(player\.id, theme\.id, trap\.malus_points\);/g,
    replace: 'await db.addMalusPoints(interaction.guildId, player.id, theme.id, trap.malus_points);',
    description: 'addMalusPoints avec guild_id'
  },

  // revealSuperBonus() - Query directe ligne 564
  {
    find: /const bonus = await db\.queryOne\('SELECT \* FROM super_bonuses WHERE id = \$1', \[bonusId\]\);/g,
    replace: "const bonus = await db.queryOne('SELECT * FROM super_bonuses WHERE id = $1 AND guild_id = $2', [bonusId, interaction.guildId]);",
    description: 'Query super_bonuses avec guild_id'
  },

  // revealSuperBonus() - ligne 574
  {
    find: /await db\.addBonusToPlayer\(interaction\.user\.id, bonusId, 'mystery_box', null\);/g,
    replace: "await db.addBonusToPlayer(interaction.guildId, interaction.user.id, bonusId, 'mystery_box', null);",
    description: 'addBonusToPlayer avec guild_id'
  },

  // handleCollectionComplete() - Query directe ligne 609
  {
    find: /const theme = await db\.queryOne\('SELECT \* FROM themes WHERE id = \$1', \[collectible\.theme_id\]\);/g,
    replace: "const theme = await db.queryOne('SELECT * FROM themes WHERE id = $1 AND guild_id = $2', [collectible.theme_id, interaction.guildId]);",
    description: 'Query themes avec guild_id'
  },

  // handleCollectionComplete() - ligne 612
  {
    find: /await db\.completeCollection\(player\.id, collectible\.theme_id\);/g,
    replace: 'await db.completeCollection(interaction.guildId, player.id, collectible.theme_id);',
    description: 'completeCollection avec guild_id'
  },

  // Ajouter deferUpdate() au début de handleMysteryBoxOpen
  {
    find: /(async handleMysteryBoxOpen\(interaction\) \{\s*const \[, , type, itemId\] = interaction\.customId\.split\('_'\);)/,
    replace: '$1\n\n    // Defer immédiatement pour éviter timeout\n    await interaction.deferUpdate();',
    description: 'Ajout deferUpdate() au début de handleMysteryBoxOpen'
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
console.log('✅ mysteryBoxHandler.js corrigé !');
