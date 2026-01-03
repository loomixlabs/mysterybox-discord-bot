const db = require('../utils/database-pg');

/**
 * Script de test du super bonus "Aimant à Légendaires"
 * Simule 1000 ouvertures de mystery boxes et analyse les résultats
 */

const GUILD_ID = process.env.GUILD_ID || '297309737135898624';
const PLAYER_DISCORD_ID = '297307186307006464'; // xmicordix
const SIMULATIONS = 1000;

/**
 * Fonction de weighted random selection (copié de mysteryBoxHandler.js)
 */
function weightedRandom(items, weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

/**
 * Simule le rollMysteryContent pour un collectible
 */
async function simulateRoll(collectibles, rarityPercentages) {
  // Grouper par rareté
  const byRarity = {
    legendary: collectibles.filter(c => c.rarity === 'legendary'),
    epic: collectibles.filter(c => c.rarity === 'epic'),
    rare: collectibles.filter(c => c.rarity === 'rare'),
    common: collectibles.filter(c => c.rarity === 'common')
  };

  // Créer la distribution pondérée
  const distribution = [];

  // Legendary
  const legendaryCount = Math.max(1, Math.round(rarityPercentages.legendary / 10));
  for (let i = 0; i < legendaryCount; i++) {
    distribution.push(...byRarity.legendary);
  }

  // Epic
  const epicCount = Math.max(1, Math.round(rarityPercentages.epic / 10));
  for (let i = 0; i < epicCount; i++) {
    distribution.push(...byRarity.epic);
  }

  // Rare
  const rareCount = Math.max(1, Math.round(rarityPercentages.rare / 10));
  for (let i = 0; i < rareCount; i++) {
    distribution.push(...byRarity.rare);
  }

  // Common
  const commonCount = Math.max(1, Math.round(rarityPercentages.common / 10));
  for (let i = 0; i < commonCount; i++) {
    distribution.push(...byRarity.common);
  }

  // Sélection aléatoire
  const randomIndex = Math.floor(Math.random() * distribution.length);
  return distribution[randomIndex];
}

async function testAimantLegendaires() {
  try {
    console.log('🧪 TEST - Super Bonus "Aimant à Légendaires"\n');
    console.log('='.repeat(80));

    // ÉTAPE 1: Récupérer le joueur
    console.log('\n📋 ÉTAPE 1: Récupération du joueur\n');

    const player = await db.queryOne(`
      SELECT * FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [GUILD_ID, PLAYER_DISCORD_ID]);

    if (!player) {
      console.log('❌ Joueur non trouvé');
      process.exit(1);
    }

    console.log(`✅ Joueur: ${player.username} (ID: ${player.id})`);

    // ÉTAPE 2: Vérifier le super bonus actif
    console.log('\n='.repeat(80));
    console.log('\n📋 ÉTAPE 2: Vérification du super bonus actif\n');

    const activeBonuses = await db.query(`
      SELECT
        pab.id,
        pab.activated_at,
        pab.expires_at,
        pab.is_active,
        sb.name,
        sb.effect_type,
        sb.bonus_id
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.user_id = $1
      AND pab.guild_id = $2
      AND pab.is_active = true
    `, [PLAYER_DISCORD_ID, GUILD_ID]);

    const aimantBonus = activeBonuses.find(b => b.bonus_id === 'legendary_magnet');

    if (!aimantBonus) {
      console.log('❌ Super bonus "Aimant à Légendaires" NON ACTIF');
      console.log('\n📊 Bonus actifs:');
      if (activeBonuses.length === 0) {
        console.log('   Aucun bonus actif\n');
      } else {
        activeBonuses.forEach(b => {
          console.log(`   • ${b.name} (${b.effect_type})`);
        });
      }
      process.exit(1);
    }

    console.log(`✅ Super bonus ACTIF: ${aimantBonus.name}`);
    console.log(`   Effect: ${aimantBonus.effect_type}`);
    console.log(`   Bonus Legendary: +50%`);
    console.log(`   Activated: ${new Date(aimantBonus.activated_at).toLocaleString()}`);

    // ÉTAPE 3: Récupérer les collectibles du thème
    console.log('\n='.repeat(80));
    console.log('\n📋 ÉTAPE 3: Récupération des collectibles\n');

    const theme = await db.queryOne(`
      SELECT * FROM themes
      WHERE guild_id = $1 AND is_active = TRUE
    `, [GUILD_ID]);

    if (!theme) {
      console.log('❌ Aucun thème actif trouvé');
      process.exit(1);
    }

    console.log(`✅ Thème actif: ${theme.name} (ID: ${theme.id})`);

    const collectibles = await db.query(`
      SELECT * FROM collectibles
      WHERE guild_id = $1 AND theme_id = $2
    `, [GUILD_ID, theme.id]);

    console.log(`✅ ${collectibles.length} collectibles disponibles`);

    const byRarity = {
      legendary: collectibles.filter(c => c.rarity === 'legendary').length,
      epic: collectibles.filter(c => c.rarity === 'epic').length,
      rare: collectibles.filter(c => c.rarity === 'rare').length,
      common: collectibles.filter(c => c.rarity === 'common').length
    };

    console.log(`\n   Legendary: ${byRarity.legendary}`);
    console.log(`   Epic: ${byRarity.epic}`);
    console.log(`   Rare: ${byRarity.rare}`);
    console.log(`   Common: ${byRarity.common}`);

    // ÉTAPE 4: Calculer les pourcentages avec bonus
    console.log('\n='.repeat(80));
    console.log('\n📋 ÉTAPE 4: Calcul des pourcentages\n');

    const basePercentages = {
      legendary: 20,
      epic: 20,
      rare: 30,
      common: 30
    };

    // Bonus "Aimant à Légendaires" = +50% sur legendary
    const bonusValue = 50;
    const legendaryBonus = Math.round(basePercentages.legendary * (bonusValue / 100));
    const adjustedPercentages = {
      legendary: basePercentages.legendary + legendaryBonus,
      epic: basePercentages.epic,
      rare: basePercentages.rare,
      common: Math.max(0, basePercentages.common - legendaryBonus)
    };

    console.log('📊 Pourcentages de base:');
    console.log(`   Legendary: ${basePercentages.legendary}%`);
    console.log(`   Epic: ${basePercentages.epic}%`);
    console.log(`   Rare: ${basePercentages.rare}%`);
    console.log(`   Common: ${basePercentages.common}%`);

    console.log(`\n✨ Pourcentages AVEC bonus (+${bonusValue}%):`);
    console.log(`   Legendary: ${adjustedPercentages.legendary}% (+${legendaryBonus}%)`);
    console.log(`   Epic: ${adjustedPercentages.epic}%`);
    console.log(`   Rare: ${adjustedPercentages.rare}%`);
    console.log(`   Common: ${adjustedPercentages.common}% (-${legendaryBonus}%)`);

    // ÉTAPE 5: Simulation
    console.log('\n='.repeat(80));
    console.log(`\n📋 ÉTAPE 5: Simulation de ${SIMULATIONS} ouvertures\n`);

    const results = {
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0
    };

    console.log(`⏳ Simulation en cours...`);

    for (let i = 0; i < SIMULATIONS; i++) {
      const collectible = await simulateRoll(collectibles, adjustedPercentages);
      results[collectible.rarity]++;

      if ((i + 1) % 100 === 0) {
        process.stdout.write(`\r   Progress: ${i + 1}/${SIMULATIONS}`);
      }
    }

    console.log(`\r   Progress: ${SIMULATIONS}/${SIMULATIONS} ✅\n`);

    // ÉTAPE 6: Analyse des résultats
    console.log('='.repeat(80));
    console.log('\n📊 RÉSULTATS DE LA SIMULATION\n');

    const percentages = {
      legendary: ((results.legendary / SIMULATIONS) * 100).toFixed(2),
      epic: ((results.epic / SIMULATIONS) * 100).toFixed(2),
      rare: ((results.rare / SIMULATIONS) * 100).toFixed(2),
      common: ((results.common / SIMULATIONS) * 100).toFixed(2)
    };

    console.log('┌─────────────┬─────────┬──────────┬──────────────┐');
    console.log('│ Rareté      │ Attendu │ Obtenu   │ Différence   │');
    console.log('├─────────────┼─────────┼──────────┼──────────────┤');

    Object.keys(adjustedPercentages).forEach(rarity => {
      const expected = adjustedPercentages[rarity];
      const actual = parseFloat(percentages[rarity]);
      const diff = (actual - expected).toFixed(2);
      const sign = diff > 0 ? '+' : '';

      const rarityPadded = rarity.padEnd(11);
      const expectedPadded = `${expected}%`.padStart(7);
      const actualPadded = `${actual}%`.padStart(8);
      const diffPadded = `${sign}${diff}%`.padStart(12);

      console.log(`│ ${rarityPadded} │ ${expectedPadded} │ ${actualPadded} │ ${diffPadded} │`);
    });

    console.log('└─────────────┴─────────┴──────────┴──────────────┘');

    // ÉTAPE 7: Verdict
    console.log('\n='.repeat(80));
    console.log('\n🎯 VERDICT\n');

    const legendaryDiff = Math.abs(parseFloat(percentages.legendary) - adjustedPercentages.legendary);

    if (legendaryDiff <= 3) {
      console.log('✅ Le super bonus "Aimant à Légendaires" FONCTIONNE CORRECTEMENT !');
      console.log(`\n   Taux de legendary observé: ${percentages.legendary}%`);
      console.log(`   Taux attendu avec bonus: ${adjustedPercentages.legendary}%`);
      console.log(`   Différence: ${legendaryDiff.toFixed(2)}% (marge acceptable: ±3%)`);
    } else {
      console.log('⚠️  Le super bonus pourrait ne pas fonctionner correctement');
      console.log(`\n   Taux de legendary observé: ${percentages.legendary}%`);
      console.log(`   Taux attendu avec bonus: ${adjustedPercentages.legendary}%`);
      console.log(`   Différence: ${legendaryDiff.toFixed(2)}% (marge acceptable: ±3%)`);
      console.log('\n💡 Note: Avec 1000 simulations, une différence >3% peut indiquer un problème');
    }

    console.log('\n' + '='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

testAimantLegendaires();
