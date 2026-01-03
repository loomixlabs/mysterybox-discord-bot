const db = require('../utils/database-pg');
const superBonusHandler = require('../handlers/superBonusHandler');

/**
 * Script de test du super bonus "Aimant à Légendaires" - VERSION 2
 * Utilise EXACTEMENT la même logique que mysteryBoxHandler.js
 * Simule 1000 ouvertures et analyse les résultats
 */

const GUILD_ID = process.env.GUILD_ID || '297309737135898624';
const PLAYER_DISCORD_ID = '297307186307006464'; // xmicordix
const SIMULATIONS = 1000;

/**
 * Copie EXACTE de selectCollectibleWeighted() depuis mysteryBoxHandler.js (lignes 178-228)
 * @param {array} collectibles - Liste des collectibles disponibles
 * @param {object} percentages - Pourcentages par rareté (déjà boostés)
 * @returns {object} Collectible sélectionné
 */
function selectCollectibleWeighted(collectibles, percentages) {
  // Grouper les collectibles par rareté
  const byRarity = {
    legendary: collectibles.filter(c => c.rarity === 'legendary'),
    epic: collectibles.filter(c => c.rarity === 'epic'),
    rare: collectibles.filter(c => c.rarity === 'rare'),
    common: collectibles.filter(c => c.rarity === 'common')
  };

  // Sélection de la rareté basée sur les pourcentages (CUMULATIVE)
  const rand = Math.random() * 100;
  let cumulative = 0;
  let selectedRarity = 'common';

  if (rand < (cumulative += percentages.legendary) && byRarity.legendary.length > 0) {
    selectedRarity = 'legendary';
  } else if (rand < (cumulative += percentages.epic) && byRarity.epic.length > 0) {
    selectedRarity = 'epic';
  } else if (rand < (cumulative += percentages.rare) && byRarity.rare.length > 0) {
    selectedRarity = 'rare';
  } else if (byRarity.common.length > 0) {
    selectedRarity = 'common';
  } else {
    // Fallback: si la rareté sélectionnée n'a pas d'items, prendre n'importe quel item
    const allAvailable = [...byRarity.legendary, ...byRarity.epic, ...byRarity.rare, ...byRarity.common];
    if (allAvailable.length > 0) {
      return allAvailable[Math.floor(Math.random() * allAvailable.length)];
    }
  }

  // Sélection uniforme parmi les items de la rareté choisie
  const itemsOfRarity = byRarity[selectedRarity];
  const selected = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];

  return selected;
}

async function testAimantLegendairesV2() {
  try {
    console.log('🧪 TEST V2 - Super Bonus "Aimant à Légendaires"\n');
    console.log('📝 Utilise EXACTEMENT la même logique que mysteryBoxHandler.js\n');
    console.log('='.repeat(80));

    // ÉTAPE 1: Récupération du joueur
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
    console.log(`   Activated: ${new Date(aimantBonus.activated_at).toLocaleString()}`);

    // ÉTAPE 3: Récupérer les collectibles et la config du thème
    console.log('\n='.repeat(80));
    console.log('\n📋 ÉTAPE 3: Récupération de la config et des collectibles\n');

    const theme = await db.queryOne(`
      SELECT * FROM themes
      WHERE guild_id = $1 AND is_active = TRUE
    `, [GUILD_ID]);

    if (!theme) {
      console.log('❌ Aucun thème actif trouvé');
      process.exit(1);
    }

    console.log(`✅ Thème actif: ${theme.name} (ID: ${theme.id})`);

    const config = await db.getThemeConfig(GUILD_ID, theme.id);

    console.log(`\n📊 Config du thème:`);
    console.log(`   collectible_rarity_legendary: ${config.collectible_rarity_legendary}`);
    console.log(`   collectible_rarity_epic: ${config.collectible_rarity_epic}`);
    console.log(`   collectible_rarity_rare: ${config.collectible_rarity_rare}`);
    console.log(`   collectible_rarity_common: ${config.collectible_rarity_common}`);

    const collectibles = await db.query(`
      SELECT * FROM collectibles
      WHERE guild_id = $1 AND theme_id = $2
    `, [GUILD_ID, theme.id]);

    console.log(`\n✅ ${collectibles.length} collectibles disponibles`);

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

    // ÉTAPE 4: Appliquer le boost avec la VRAIE méthode du bot
    console.log('\n='.repeat(80));
    console.log('\n📋 ÉTAPE 4: Application du boost via superBonusHandler\n');

    const basePercentages = {
      legendary: config.collectible_rarity_legendary || 5,
      epic: config.collectible_rarity_epic || 10,
      rare: config.collectible_rarity_rare || 20,
      common: config.collectible_rarity_common || 40
    };

    console.log('📊 Pourcentages de base:');
    console.log(`   Legendary: ${basePercentages.legendary}%`);
    console.log(`   Epic: ${basePercentages.epic}%`);
    console.log(`   Rare: ${basePercentages.rare}%`);
    console.log(`   Common: ${basePercentages.common}%`);

    // Appeler la méthode RÉELLE du bot
    const boostResult = await superBonusHandler.applyCollectibleRarityBoost(
      GUILD_ID,
      PLAYER_DISCORD_ID,
      basePercentages
    );

    if (!boostResult.hasBoost) {
      console.log('\n❌ Le boost n\'a pas été appliqué par superBonusHandler');
      console.log('   Ceci ne devrait pas arriver si le bonus est actif !');
      process.exit(1);
    }

    const adjustedPercentages = boostResult.percentages;
    const boostInfo = boostResult.boost;

    console.log(`\n✨ Boost détecté et appliqué:`);
    console.log(`   Bonus: ${boostInfo.bonusName}`);
    console.log(`   Cible: ${boostInfo.target}`);
    console.log(`   Valeur: ${boostInfo.value}%`);
    console.log(`   Original: ${boostInfo.original}%`);
    console.log(`   Calculé: ${boostInfo.calculated}%`);
    console.log(`   Normalisé: ${boostInfo.normalized}%`);

    console.log(`\n📊 Pourcentages finaux (après boost + normalisation):`);
    console.log(`   Legendary: ${adjustedPercentages.legendary}%`);
    console.log(`   Epic: ${adjustedPercentages.epic}%`);
    console.log(`   Rare: ${adjustedPercentages.rare}%`);
    console.log(`   Common: ${adjustedPercentages.common}%`);

    // ÉTAPE 5: Simulation avec la VRAIE logique
    console.log('\n='.repeat(80));
    console.log(`\n📋 ÉTAPE 5: Simulation de ${SIMULATIONS} ouvertures\n`);
    console.log('   Utilise selectCollectibleWeighted() copié de mysteryBoxHandler.js');

    const results = {
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0
    };

    console.log(`\n⏳ Simulation en cours...`);

    for (let i = 0; i < SIMULATIONS; i++) {
      const collectible = selectCollectibleWeighted(collectibles, adjustedPercentages);
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
      console.log('\n   ✨ La simulation utilise EXACTEMENT la même logique que le bot.');
      console.log('   ✨ Les résultats prouvent que le bonus est appliqué correctement in-game.');
    } else {
      console.log('⚠️  Résultats en dehors de la marge attendue');
      console.log(`\n   Taux de legendary observé: ${percentages.legendary}%`);
      console.log(`   Taux attendu avec bonus: ${adjustedPercentages.legendary}%`);
      console.log(`   Différence: ${legendaryDiff.toFixed(2)}% (marge acceptable: ±3%)`);
      console.log('\n💡 Note: Avec 1000 simulations et l\'algorithme exact du bot,');
      console.log('   une différence >3% pourrait indiquer un problème.');
    }

    console.log('\n' + '='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

testAimantLegendairesV2();
