/**
 * Script de correction pour adminPanelHandler.js
 * - Correction guild_id manquant dans multiples fonctions
 * - Correction threads non archivés après upload image
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'handlers/adminPanelHandler.js');
let content = fs.readFileSync(filePath, 'utf8');
let modificationsCount = 0;

console.log('🔧 Correction de adminPanelHandler.js...\n');

const corrections = [
  // showSettingsMenu() - ligne 2014
  {
    find: /async showSettingsMenu\(interaction\) \{\s*const theme = await db\.getActiveTheme\(\);/,
    replace: 'async showSettingsMenu(interaction) {\n    const theme = await db.getActiveTheme(interaction.guildId);',
    description: 'showSettingsMenu: getActiveTheme avec guild_id'
  },

  // showSettingsMenu() - ligne 2015
  {
    find: /const theme = await db\.getActiveTheme\(interaction\.guildId\);\s*const allThemes = await db\.getAllThemes\(\);/,
    replace: 'const theme = await db.getActiveTheme(interaction.guildId);\n    const allThemes = await db.getAllThemes(interaction.guildId);',
    description: 'showSettingsMenu: getAllThemes avec guild_id'
  },

  // showGiveUniqueMenu() - ligne 2091
  {
    find: /async showGiveUniqueMenu\(interaction\) \{\s*const theme = await db\.getActiveTheme\(\);/,
    replace: 'async showGiveUniqueMenu(interaction) {\n    const theme = await db.getActiveTheme(interaction.guildId);',
    description: 'showGiveUniqueMenu: getActiveTheme avec guild_id'
  },

  // showChannelsMenu() - ligne 2222
  {
    find: /async showChannelsMenu\(interaction\) \{\s*const giveChannels = await db\.getAllGiveChannels\(\);/,
    replace: 'async showChannelsMenu(interaction) {\n    const giveChannels = await db.getAllGiveChannels(interaction.guildId);',
    description: 'showChannelsMenu: getAllGiveChannels avec guild_id'
  },

  // showChannelsMenu() - ligne 2231 (dans la boucle)
  {
    find: /const catChannels = await db\.getChannelsByCategory\(cat\.discord_id\);/g,
    replace: 'const catChannels = await db.getChannelsByCategory(interaction.guildId, cat.discord_id);',
    description: 'showChannelsMenu: getChannelsByCategory avec guild_id'
  },

  // handleGiveUniqueRandom() - ligne 2314
  {
    find: /async handleGiveUniqueRandom\(interaction\) \{\s*await interaction\.deferUpdate\(\);\s*try \{\s*const theme = await db\.getActiveTheme\(\);/gs,
    replace: 'async handleGiveUniqueRandom(interaction) {\n    await interaction.deferUpdate();\n\n    try {\n      const theme = await db.getActiveTheme(interaction.guildId);',
    description: 'handleGiveUniqueRandom: getActiveTheme avec guild_id'
  },

  // handleGiveUniqueRandom() - lignes 2318-2319
  {
    find: /const categories = await db\.getGiveCategories\(\);\s*const channels = await db\.getGiveChannelsList\(\);/,
    replace: 'const categories = await db.getGiveCategories(interaction.guildId);\n      const channels = await db.getGiveChannelsList(interaction.guildId);',
    description: 'handleGiveUniqueRandom: getGiveCategories + getGiveChannelsList avec guild_id'
  },

  // handleImageUploadViaThread() - ligne 1259 (Mystery Box)
  {
    find: /if \(context === 'Mystery Box - Image'\) \{\s*const theme = await db\.getActiveTheme\(\);/,
    replace: "if (context === 'Mystery Box - Image') {\n          const theme = await db.getActiveTheme(interaction.guildId);",
    description: 'handleImageUploadViaThread: getActiveTheme avec guild_id (Mystery Box)'
  },

  // handleRaritySelection() - Archiver thread après modal (ligne 1526)
  {
    find: /(async handleRaritySelection\(interaction\) \{[\s\S]*?\/\/ Ouvrir le modal avec la rareté sélectionnée et le themeId\s*await this\.showAddCollectibleModal\(interaction, rarity, themeId\);)\s*\}/,
    replace: `$1

    // Archiver le thread après ouverture du modal
    if (interaction.channel?.isThread()) {
      setTimeout(async () => {
        try {
          await interaction.channel.setArchived(true);
        } catch (error) {
          console.warn('⚠️ Impossible d\\'archiver le thread:', error);
        }
      }, 2000);
    }
  }`,
    description: 'handleRaritySelection: archiver thread après ouverture modal'
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
console.log('✅ adminPanelHandler.js corrigé !');
