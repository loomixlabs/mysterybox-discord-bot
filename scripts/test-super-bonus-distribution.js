const db = require('../utils/database-pg');

/**
 * Script de test - Distribution Super Bonus en conditions réelles
 *
 * Ce script:
 * 1. Vérifie la configuration actuelle des probabilités
 * 2. Affiche les super bonus actifs
 * 3. Simule 100 ouvertures pour vérifier la distribution
 * 4. Vérifie les bonus obtenus récemment
 */
async function testSuperBonusDistribution() {
  console.log('\n🧪 TEST - Distribution Super Bonus en Conditions Réelles\n');
  console.log('='.repeat(100));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // ========================================
    // 1. VÉRIFIER LA CONFIGURATION
    // ========================================
    console.log('\n📋 ÉTAPE 1: Configuration Actuelle des Probabilités\n');
    console.log('-'.repeat(100));

    const config = await db.queryOne(`
      SELECT
        tc.theme_id,
        t.name as theme_name,
        tc.probability_collectible,
        tc.probability_mission,
        tc.probability_trap,
        tc.probability_super_bonus,
        (tc.probability_collectible + tc.probability_mission + tc.probability_trap + COALESCE(tc.probability_super_bonus, 0)) as total
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE tc.guild_id = $1 AND t.is_active = true
    `, [guildId]);

    if (!config) {
      console.log('❌ Aucune configuration trouvée pour le thème actif');
      process.exit(1);
    }

    console.log(`Thème: ${config.theme_name}\n`);
    console.table([{
      'Collectible (%)': config.probability_collectible,
      'Mission (%)': config.probability_mission,
      'Trap (%)': config.probability_trap,
      'Super Bonus (%)': config.probability_super_bonus || 0,
      'TOTAL (%)': config.total
    }]);

    if (config.total !== 100) {
      console.log(`\n⚠️  ATTENTION: La somme des probabilités est ${config.total}% (devrait être 100%)`);
    } else {
      console.log('\n✅ Somme des probabilités = 100%');
    }

    // ========================================
    // 2. SUPER BONUS DISPONIBLES
    // ========================================
    console.log('\n📋 ÉTAPE 2: Super Bonus Disponibles\n');
    console.log('-'.repeat(100));

    const bonuses = await db.queryAll(`
      SELECT
        bonus_id,
        name,
        rarity,
        activation_mode,
        duration_type,
        duration_value
      FROM super_bonuses
      WHERE guild_id = $1
      ORDER BY
        CASE rarity
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'common' THEN 4
        END,
        name
    `, [guildId]);

    console.log(`\nNombre total: ${bonuses.length}\n`);

    // Grouper par mode d'activation
    const automatic = bonuses.filter(b => b.activation_mode === 'automatic');
    const manual = bonuses.filter(b => b.activation_mode === 'manual');

    console.log(`🎰 AUTOMATIQUES (${automatic.length}):`);
    automatic.forEach(b => {
      const duration = b.duration_type === 'temporary'
        ? `${b.duration_value}s`
        : b.duration_type === 'charges'
        ? `${b.duration_value} charges`
        : 'permanent';
      console.log(`   - ${b.name} (${b.rarity}) - ${duration}`);
    });

    console.log(`\n📱 MANUELS (${manual.length}):`);
    manual.forEach(b => {
      const duration = b.duration_type === 'temporary'
        ? `${b.duration_value}s`
        : b.duration_type === 'charges'
        ? `${b.duration_value} charges`
        : 'permanent';
      console.log(`   - ${b.name} (${b.rarity}) - ${duration}`);
    });

    // ========================================
    // 3. BONUS OBTENUS RÉCEMMENT
    // ========================================
    console.log('\n📋 ÉTAPE 3: Super Bonus Obtenus Récemment (7 derniers jours)\n');
    console.log('-'.repeat(100));

    const recentBonuses = await db.queryAll(`
      SELECT
        p.username,
        sb.name as bonus_name,
        sb.activation_mode,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        pab.is_active,
        pab.obtained_from,
        pab.created_at
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      WHERE pab.guild_id = $1
      AND pab.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY pab.created_at DESC
      LIMIT 20
    `, [guildId]);

    if (recentBonuses.length === 0) {
      console.log('ℹ️  Aucun super bonus obtenu dans les 7 derniers jours\n');
      console.log('💡 Pour tester:');
      console.log('   1. Augmentez probability_super_bonus à 50% via Admin Panel');
      console.log('   2. Ouvrez plusieurs mystery boxes sur Discord');
      console.log('   3. Relancez ce script pour voir les résultats\n');
    } else {
      console.log(`\n${recentBonuses.length} bonus obtenu(s):\n`);

      for (const bonus of recentBonuses) {
        const activationStatus = bonus.activation_mode === 'automatic'
          ? `✅ ACTIVÉ (${bonus.activated_at?.toISOString() || 'N/A'})`
          : bonus.activated_at
          ? `✅ ACTIVÉ (${bonus.activated_at.toISOString()})`
          : '⏸️  EN ATTENTE';

        console.log(`👤 ${bonus.username}`);
        console.log(`   Bonus: ${bonus.bonus_name} (${bonus.activation_mode})`);
        console.log(`   Status: ${activationStatus}`);
        console.log(`   Obtenu: ${bonus.created_at.toISOString()}`);
        console.log(`   Source: ${bonus.obtained_from}`);

        if (bonus.expires_at) {
          console.log(`   Expire: ${bonus.expires_at.toISOString()}`);
        }

        if (bonus.remaining_charges !== null) {
          console.log(`   Charges restantes: ${bonus.remaining_charges}`);
        }

        console.log('');
      }

      // Statistiques
      const automaticCount = recentBonuses.filter(b => b.activation_mode === 'automatic').length;
      const manualCount = recentBonuses.filter(b => b.activation_mode === 'manual').length;
      const activatedCount = recentBonuses.filter(b => b.activated_at !== null).length;

      console.log('📊 Statistiques:');
      console.log(`   - Automatiques: ${automaticCount}`);
      console.log(`   - Manuels: ${manualCount}`);
      console.log(`   - Activés: ${activatedCount}/${recentBonuses.length}`);
    }

    // ========================================
    // 4. SIMULATION DE DISTRIBUTION
    // ========================================
    console.log('\n📋 ÉTAPE 4: Simulation de Distribution (1000 rolls)\n');
    console.log('-'.repeat(100));

    const results = {
      collectible: 0,
      mission: 0,
      trap: 0,
      super_bonus: 0
    };

    const nbRolls = 1000;

    for (let i = 0; i < nbRolls; i++) {
      const roll = Math.floor(Math.random() * 100) + 1; // 1-100

      if (roll <= config.probability_collectible) {
        results.collectible++;
      } else if (roll <= config.probability_collectible + config.probability_mission) {
        results.mission++;
      } else if (roll <= config.probability_collectible + config.probability_mission + config.probability_trap) {
        results.trap++;
      } else {
        results.super_bonus++;
      }
    }

    console.log(`Sur ${nbRolls} rolls:\n`);
    console.table([{
      'Type': 'Collectible',
      'Obtenu': results.collectible,
      'Pourcentage': `${(results.collectible / nbRolls * 100).toFixed(1)}%`,
      'Attendu': `${config.probability_collectible}%`,
      'Écart': `${Math.abs((results.collectible / nbRolls * 100) - config.probability_collectible).toFixed(1)}%`
    }, {
      'Type': 'Mission',
      'Obtenu': results.mission,
      'Pourcentage': `${(results.mission / nbRolls * 100).toFixed(1)}%`,
      'Attendu': `${config.probability_mission}%`,
      'Écart': `${Math.abs((results.mission / nbRolls * 100) - config.probability_mission).toFixed(1)}%`
    }, {
      'Type': 'Trap',
      'Obtenu': results.trap,
      'Pourcentage': `${(results.trap / nbRolls * 100).toFixed(1)}%`,
      'Attendu': `${config.probability_trap}%`,
      'Écart': `${Math.abs((results.trap / nbRolls * 100) - config.probability_trap).toFixed(1)}%`
    }, {
      'Type': 'Super Bonus',
      'Obtenu': results.super_bonus,
      'Pourcentage': `${(results.super_bonus / nbRolls * 100).toFixed(1)}%`,
      'Attendu': `${config.probability_super_bonus || 0}%`,
      'Écart': `${Math.abs((results.super_bonus / nbRolls * 100) - (config.probability_super_bonus || 0)).toFixed(1)}%`
    }]);

    // ========================================
    // RÉSUMÉ FINAL
    // ========================================
    console.log('\n' + '='.repeat(100));
    console.log('📊 RÉSUMÉ DU TEST\n');

    console.log('✅ Configuration:');
    console.log(`   - Probabilités: ${config.probability_collectible}% / ${config.probability_mission}% / ${config.probability_trap}% / ${config.probability_super_bonus || 0}%`);
    console.log(`   - Total: ${config.total}% ${config.total === 100 ? '✅' : '❌'}`);

    console.log('\n✅ Super Bonus:');
    console.log(`   - Total disponibles: ${bonuses.length}`);
    console.log(`   - Automatiques: ${automatic.length}`);
    console.log(`   - Manuels: ${manual.length}`);

    console.log('\n✅ Distribution simulée:');
    console.log(`   - Super Bonus obtenus: ${results.super_bonus}/${nbRolls} (${(results.super_bonus / nbRolls * 100).toFixed(1)}%)`);
    console.log(`   - Écart avec probabilité attendue: ${Math.abs((results.super_bonus / nbRolls * 100) - (config.probability_super_bonus || 0)).toFixed(1)}%`);

    if (recentBonuses.length > 0) {
      console.log('\n✅ Bonus obtenus (7 derniers jours):');
      console.log(`   - Total: ${recentBonuses.length}`);
      console.log(`   - Automatiques: ${recentBonuses.filter(b => b.activation_mode === 'automatic').length}`);
      console.log(`   - Manuels: ${recentBonuses.filter(b => b.activation_mode === 'manual').length}`);
      console.log(`   - Activés: ${recentBonuses.filter(b => b.activated_at !== null).length}`);
    }

    console.log('\n💡 Prochaines étapes pour tests manuels:');
    console.log('   1. Augmenter probability_super_bonus à 50% via /admin-panel');
    console.log('   2. Ouvrir 20-30 mystery boxes sur Discord');
    console.log('   3. Vérifier que des super bonus apparaissent');
    console.log('   4. Vérifier les bonus automatiques (activated_at = NOW())');
    console.log('   5. Vérifier les bonus manuels (activated_at = NULL)');
    console.log('   6. Relancer ce script pour voir les statistiques\n');

    console.log('='.repeat(100));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR lors du test:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testSuperBonusDistribution();
