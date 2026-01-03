const db = require('../utils/database-pg');

async function fixPercentages() {
  console.log('\n🔧 CORRECTION DES POURCENTAGES DE RARETÉ\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Récupérer le thème actif
    console.log('\n📋 Thème actif:\n');
    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      console.error('❌ Aucun thème actif trouvé');
      process.exit(1);
    }
    console.log(`✅ Thème: ${theme.name} (ID: ${theme.id})`);

    // Afficher les valeurs actuelles
    console.log('\n📊 VALEURS ACTUELLES:\n');
    const currentConfig = await db.queryOne(`
      SELECT
        collectible_rarity_legendary,
        collectible_rarity_epic,
        collectible_rarity_rare,
        collectible_rarity_common,
        super_bonus_rarity_legendary,
        super_bonus_rarity_epic,
        super_bonus_rarity_rare,
        super_bonus_rarity_common
      FROM theme_config
      WHERE theme_id = $1
    `, [theme.id]);

    const collectibleTotal =
      currentConfig.collectible_rarity_legendary +
      currentConfig.collectible_rarity_epic +
      currentConfig.collectible_rarity_rare +
      currentConfig.collectible_rarity_common;

    const bonusTotal =
      currentConfig.super_bonus_rarity_legendary +
      currentConfig.super_bonus_rarity_epic +
      currentConfig.super_bonus_rarity_rare +
      currentConfig.super_bonus_rarity_common;

    console.log(`🎁 Collectibles: ${collectibleTotal}% ${collectibleTotal === 100 ? '✅' : '❌'}`);
    console.log(`   Legendary: ${currentConfig.collectible_rarity_legendary}%`);
    console.log(`   Epic:      ${currentConfig.collectible_rarity_epic}%`);
    console.log(`   Rare:      ${currentConfig.collectible_rarity_rare}%`);
    console.log(`   Common:    ${currentConfig.collectible_rarity_common}%`);

    console.log(`\n✨ Super Bonuses: ${bonusTotal}% ${bonusTotal === 100 ? '✅' : '❌'}`);
    console.log(`   Legendary: ${currentConfig.super_bonus_rarity_legendary}%`);
    console.log(`   Epic:      ${currentConfig.super_bonus_rarity_epic}%`);
    console.log(`   Rare:      ${currentConfig.super_bonus_rarity_rare}%`);
    console.log(`   Common:    ${currentConfig.super_bonus_rarity_common}%`);

    // Mettre à jour avec des pourcentages corrects (totalisent 100%)
    console.log('\n🔄 MISE À JOUR DES POURCENTAGES...\n');

    // Distribution équilibrée: Legendary 5%, Epic 15%, Rare 30%, Common 50%
    const newValues = {
      legendary: 5,
      epic: 15,
      rare: 30,
      common: 50
    };

    await db.query(`
      UPDATE theme_config
      SET
        collectible_rarity_legendary = $1,
        collectible_rarity_epic = $2,
        collectible_rarity_rare = $3,
        collectible_rarity_common = $4,
        super_bonus_rarity_legendary = $5,
        super_bonus_rarity_epic = $6,
        super_bonus_rarity_rare = $7,
        super_bonus_rarity_common = $8
      WHERE theme_id = $9
    `, [
      newValues.legendary, newValues.epic, newValues.rare, newValues.common,
      newValues.legendary, newValues.epic, newValues.rare, newValues.common,
      theme.id
    ]);

    console.log('✅ Pourcentages mis à jour !');

    // Afficher les nouvelles valeurs
    console.log('\n📊 NOUVELLES VALEURS:\n');
    const total = newValues.legendary + newValues.epic + newValues.rare + newValues.common;

    console.log(`🎁 Collectibles: ${total}% ✅`);
    console.log(`   🟣 Legendary: ${newValues.legendary}%`);
    console.log(`   🟠 Epic:      ${newValues.epic}%`);
    console.log(`   🔵 Rare:      ${newValues.rare}%`);
    console.log(`   ⚪ Common:    ${newValues.common}%`);

    console.log(`\n✨ Super Bonuses: ${total}% ✅`);
    console.log(`   🟣 Legendary: ${newValues.legendary}%`);
    console.log(`   🟠 Epic:      ${newValues.epic}%`);
    console.log(`   🔵 Rare:      ${newValues.rare}%`);
    console.log(`   ⚪ Common:    ${newValues.common}%`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Correction terminée avec succès !');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixPercentages();
