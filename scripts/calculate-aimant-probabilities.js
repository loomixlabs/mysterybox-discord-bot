const db = require('../utils/database-pg');

async function calculateAimantProbabilities() {
  try {
    const GUILD_ID = '297309737135898624'; // Serveur de TEST
    const USER_ID = '297307186307006464'; // Ton user ID

    console.log('🎯 CALCUL - Probabilités avec Aimant à Légendaires\n');
    console.log('='.repeat(80));

    // 1. Récupérer les probabilités de base
    const themeConfig = await db.query(`
      SELECT collectible_rarity_legendary, collectible_rarity_epic,
             collectible_rarity_rare, collectible_rarity_common
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id AND tc.guild_id = t.guild_id
      WHERE t.guild_id = $1 AND t.is_active = TRUE
      LIMIT 1
    `, [GUILD_ID]);

    if (themeConfig.length === 0) {
      console.log('❌ Aucun thème actif avec config trouvé');
      process.exit(1);
    }

    const config = themeConfig[0];
    const baseProbabilities = {
      legendary: config.collectible_rarity_legendary || 5,
      epic: config.collectible_rarity_epic || 10,
      rare: config.collectible_rarity_rare || 20,
      common: config.collectible_rarity_common || 40
    };

    console.log('\n📊 ÉTAPE 1: Probabilités de base (DB)\n');
    console.table({
      'Legendary': { 'Probabilité': `${baseProbabilities.legendary}%` },
      'Epic': { 'Probabilité': `${baseProbabilities.epic}%` },
      'Rare': { 'Probabilité': `${baseProbabilities.rare}%` },
      'Common': { 'Probabilité': `${baseProbabilities.common}%` }
    });

    const baseTotal = baseProbabilities.legendary + baseProbabilities.epic +
                      baseProbabilities.rare + baseProbabilities.common;
    console.log(`\nTotal base: ${baseTotal}%`);

    // 2. Récupérer la config de l'Aimant
    const aimant = await db.query(`
      SELECT pab.*, sb.effect_config
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
      AND pab.user_id = $2
      AND sb.name = 'Aimant à Légendaires'
      AND pab.is_active = TRUE
      LIMIT 1
    `, [GUILD_ID, USER_ID]);

    if (aimant.length === 0) {
      console.log('\n❌ Aucun Aimant à Légendaires actif pour cet utilisateur');
      process.exit(1);
    }

    const effectConfig = aimant[0].effect_config;
    const boostPercentage = effectConfig.boost_percentage;
    const targetRarity = effectConfig.target_rarity;

    console.log('\n' + '='.repeat(80));
    console.log('\n🧲 ÉTAPE 2: Application du boost Aimant\n');
    console.log(`   Boost: +${boostPercentage}% sur ${targetRarity}`);

    // 3. Appliquer le boost (addition absolue)
    const boostedProbabilities = { ...baseProbabilities };
    boostedProbabilities[targetRarity] += boostPercentage;

    console.log(`\n   ${targetRarity}: ${baseProbabilities[targetRarity]}% + ${boostPercentage}% = ${boostedProbabilities[targetRarity]}%`);

    const boostedTotal = boostedProbabilities.legendary + boostedProbabilities.epic +
                         boostedProbabilities.rare + boostedProbabilities.common;

    console.log(`\n📋 Probabilités après boost (AVANT normalisation):\n`);
    console.table({
      'Legendary': { 'Probabilité': `${boostedProbabilities.legendary}%` },
      'Epic': { 'Probabilité': `${boostedProbabilities.epic}%` },
      'Rare': { 'Probabilité': `${boostedProbabilities.rare}%` },
      'Common': { 'Probabilité': `${boostedProbabilities.common}%` }
    });
    console.log(`\nTotal après boost: ${boostedTotal}% ⚠️ Dépasse 100% !`);

    // 4. Normaliser à 100%
    console.log('\n' + '='.repeat(80));
    console.log('\n⚖️  ÉTAPE 3: Normalisation à 100%\n');

    const factor = 100 / boostedTotal;
    console.log(`   Facteur de normalisation: 100 / ${boostedTotal} = ${factor.toFixed(4)}`);

    const normalizedProbabilities = {
      legendary: Math.round(boostedProbabilities.legendary * factor),
      epic: Math.round(boostedProbabilities.epic * factor),
      rare: Math.round(boostedProbabilities.rare * factor),
      common: Math.round(boostedProbabilities.common * factor)
    };

    console.log(`\n📈 Probabilités FINALES (après normalisation):\n`);
    console.table({
      'Legendary': {
        'Base': `${baseProbabilities.legendary}%`,
        'Après Boost': `${boostedProbabilities.legendary}%`,
        'Normalisé': `${normalizedProbabilities.legendary}%`,
        'Gain': `+${normalizedProbabilities.legendary - baseProbabilities.legendary}%`
      },
      'Epic': {
        'Base': `${baseProbabilities.epic}%`,
        'Après Boost': `${boostedProbabilities.epic}%`,
        'Normalisé': `${normalizedProbabilities.epic}%`,
        'Perte': `-${baseProbabilities.epic - normalizedProbabilities.epic}%`
      },
      'Rare': {
        'Base': `${baseProbabilities.rare}%`,
        'Après Boost': `${boostedProbabilities.rare}%`,
        'Normalisé': `${normalizedProbabilities.rare}%`,
        'Perte': `-${baseProbabilities.rare - normalizedProbabilities.rare}%`
      },
      'Common': {
        'Base': `${baseProbabilities.common}%`,
        'Après Boost': `${boostedProbabilities.common}%`,
        'Normalisé': `${normalizedProbabilities.common}%`,
        'Perte': `-${baseProbabilities.common - normalizedProbabilities.common}%`
      }
    });

    const finalTotal = normalizedProbabilities.legendary + normalizedProbabilities.epic +
                       normalizedProbabilities.rare + normalizedProbabilities.common;

    console.log(`\n✅ Total final: ${finalTotal}%`);

    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 RÉSUMÉ\n');
    console.log(`Avec l'Aimant à Légendaires (+${boostPercentage}%), tes chances de tirer legendary passent de:`);
    console.log(`   ${baseProbabilities.legendary}% → ${normalizedProbabilities.legendary}% (${normalizedProbabilities.legendary > baseProbabilities.legendary ? '+' : ''}${normalizedProbabilities.legendary - baseProbabilities.legendary}%)`);
    console.log(`\nEn contrepartie, les autres raretés diminuent légèrement pour maintenir le total à 100%.\n`);

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

calculateAimantProbabilities();
