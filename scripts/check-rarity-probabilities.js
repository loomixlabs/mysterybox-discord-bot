const db = require('../utils/database-pg');

async function checkProbabilities() {
  console.log('\n🎲 VÉRIFICATION PROBABILITÉS PAR RARETÉ\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Récupérer le thème actif
    console.log('\n📋 THÈME ACTIF:\n');
    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      console.error('❌ Aucun thème actif trouvé');
      process.exit(1);
    }
    console.log(`✅ Thème: ${theme.name} (ID: ${theme.id})`);

    // Récupérer la configuration du thème
    console.log('\n⚙️ CONFIGURATION PROBABILITÉS:\n');
    const config = await db.queryOne(`
      SELECT
        -- Collectibles
        collectible_rarity_legendary,
        collectible_rarity_epic,
        collectible_rarity_rare,
        collectible_rarity_common,
        -- Super Bonuses
        super_bonus_rarity_legendary,
        super_bonus_rarity_epic,
        super_bonus_rarity_rare,
        super_bonus_rarity_common
      FROM theme_config
      WHERE theme_id = $1
    `, [theme.id]);

    if (!config) {
      console.error('❌ Configuration introuvable');
      process.exit(1);
    }

    // Afficher les probabilités collectibles
    console.log('🎁 COLLECTIBLES - Probabilités par rareté:');
    console.log('─'.repeat(60));
    const collectibleTotal =
      config.collectible_rarity_legendary +
      config.collectible_rarity_epic +
      config.collectible_rarity_rare +
      config.collectible_rarity_common;

    console.log(`🟣 Legendary: ${config.collectible_rarity_legendary}%`);
    console.log(`🟠 Epic:      ${config.collectible_rarity_epic}%`);
    console.log(`🔵 Rare:      ${config.collectible_rarity_rare}%`);
    console.log(`⚪ Common:    ${config.collectible_rarity_common}%`);
    console.log(`─────────────`);
    console.log(`📊 TOTAL:     ${collectibleTotal}% ${collectibleTotal === 100 ? '✅' : '❌'}`);

    // Afficher les probabilités super bonuses
    console.log('\n✨ SUPER BONUSES - Probabilités par rareté:');
    console.log('─'.repeat(60));
    const bonusTotal =
      config.super_bonus_rarity_legendary +
      config.super_bonus_rarity_epic +
      config.super_bonus_rarity_rare +
      config.super_bonus_rarity_common;

    console.log(`🟣 Legendary: ${config.super_bonus_rarity_legendary}%`);
    console.log(`🟠 Epic:      ${config.super_bonus_rarity_epic}%`);
    console.log(`🔵 Rare:      ${config.super_bonus_rarity_rare}%`);
    console.log(`⚪ Common:    ${config.super_bonus_rarity_common}%`);
    console.log(`─────────────`);
    console.log(`📊 TOTAL:     ${bonusTotal}% ${bonusTotal === 100 ? '✅' : '❌'}`);

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkProbabilities();
