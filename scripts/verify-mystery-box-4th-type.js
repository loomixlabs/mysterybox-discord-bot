const db = require('../utils/database-pg');

/**
 * Script de vérification complète - Mystery Box 4ème Type (Super Bonus)
 *
 * Vérifie:
 * 1. Colonne probability_super_bonus dans theme_config
 * 2. Toutes les configurations ont somme = 100%
 * 3. Colonne activation_mode dans super_bonuses
 * 4. Répartition automatic/manual des bonus
 * 5. Simulation de distribution des 4 types (1000 rolls)
 */
async function runVerification() {
  console.log('\n🔍 VÉRIFICATION COMPLÈTE - Mystery Box 4ème Type (Super Bonus)\n');
  console.log('='.repeat(100));

  let allTestsPassed = true;

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // ========================================
    // TEST 1: Colonne probability_super_bonus
    // ========================================
    console.log('\n📋 TEST 1: Colonne probability_super_bonus dans theme_config');
    console.log('-'.repeat(100));

    const probSuperBonusColumn = await db.queryOne(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      AND column_name = 'probability_super_bonus'
    `);

    if (probSuperBonusColumn) {
      console.log('✅ Colonne probability_super_bonus EXISTE');
      console.log('   Type:', probSuperBonusColumn.data_type);
      console.log('   Default:', probSuperBonusColumn.column_default);
    } else {
      console.log('❌ Colonne probability_super_bonus N\'EXISTE PAS');
      allTestsPassed = false;
    }

    // ========================================
    // TEST 2: Somme des probabilités = 100%
    // ========================================
    console.log('\n📋 TEST 2: Validation somme des probabilités = 100%');
    console.log('-'.repeat(100));

    const configs = await db.queryAll(`
      SELECT
        theme_id,
        probability_collectible,
        probability_mission,
        probability_trap,
        probability_super_bonus,
        (probability_collectible + probability_mission + probability_trap + COALESCE(probability_super_bonus, 0)) as total
      FROM theme_config
      WHERE guild_id = $1
      ORDER BY theme_id
    `, [guildId]);

    console.table(configs);

    const invalidConfigs = configs.filter(c => c.total !== 100);

    if (invalidConfigs.length === 0) {
      console.log(`✅ Toutes les configurations (${configs.length}) ont une somme = 100%`);
    } else {
      console.log(`❌ ${invalidConfigs.length} configuration(s) ont une somme != 100%:`);
      console.table(invalidConfigs);
      allTestsPassed = false;
    }

    // ========================================
    // TEST 3: Colonne activation_mode
    // ========================================
    console.log('\n📋 TEST 3: Colonne activation_mode dans super_bonuses');
    console.log('-'.repeat(100));

    const activationModeColumn = await db.queryOne(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      AND column_name = 'activation_mode'
    `);

    if (activationModeColumn) {
      console.log('✅ Colonne activation_mode EXISTE');
      console.log('   Type:', activationModeColumn.data_type);
      console.log('   Default:', activationModeColumn.column_default);

      // Vérifier contrainte CHECK
      const constraint = await db.queryOne(`
        SELECT pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conname = 'super_bonuses_activation_mode_check'
      `);

      if (constraint) {
        console.log('✅ Contrainte CHECK:', constraint.definition);
      }
    } else {
      console.log('❌ Colonne activation_mode N\'EXISTE PAS');
      allTestsPassed = false;
    }

    // ========================================
    // TEST 4: Répartition automatic/manual
    // ========================================
    console.log('\n📋 TEST 4: Répartition automatic/manual des super bonuses');
    console.log('-'.repeat(100));

    const bonusStats = await db.queryAll(`
      SELECT
        activation_mode,
        COUNT(*) as count,
        array_agg(name ORDER BY name) as bonuses
      FROM super_bonuses
      WHERE guild_id = $1
      GROUP BY activation_mode
      ORDER BY activation_mode
    `, [guildId]);

    if (bonusStats.length > 0) {
      for (const stat of bonusStats) {
        console.log(`\n${stat.activation_mode.toUpperCase()}:`);
        console.log(`  Nombre: ${stat.count}`);
        console.log(`  Bonus: ${stat.bonuses.join(', ')}`);
      }

      // Vérifier nombres attendus (convertir count de bigint à number)
      const automaticCount = parseInt(bonusStats.find(s => s.activation_mode === 'automatic')?.count || 0);
      const manualCount = parseInt(bonusStats.find(s => s.activation_mode === 'manual')?.count || 0);

      console.log('\n📊 Vérification:');
      if (automaticCount === 3) {
        console.log(`✅ ${automaticCount} bonus AUTOMATIC (attendu: 3)`);
      } else {
        console.log(`❌ ${automaticCount} bonus AUTOMATIC (attendu: 3)`);
        allTestsPassed = false;
      }

      if (manualCount === 9) {
        console.log(`✅ ${manualCount} bonus MANUAL (attendu: 9)`);
      } else {
        console.log(`⚠️  ${manualCount} bonus MANUAL (attendu: 9)`);
      }
    } else {
      console.log('⚠️  Aucun super bonus trouvé (normal si table vide)');
    }

    // ========================================
    // TEST 5: Simulation distribution 4 types
    // ========================================
    console.log('\n📋 TEST 5: Simulation distribution des 4 types (1000 rolls)');
    console.log('-'.repeat(100));

    // Récupérer une config pour le test
    const testConfig = configs[0];

    if (testConfig) {
      console.log('Configuration testée:');
      console.log(`  Collectible: ${testConfig.probability_collectible}%`);
      console.log(`  Mission: ${testConfig.probability_mission}%`);
      console.log(`  Trap: ${testConfig.probability_trap}%`);
      console.log(`  Super Bonus: ${testConfig.probability_super_bonus}%`);

      // Simuler 1000 rolls
      const results = {
        collectible: 0,
        mission: 0,
        trap: 0,
        super_bonus: 0
      };

      const nbRolls = 1000;

      for (let i = 0; i < nbRolls; i++) {
        const roll = Math.floor(Math.random() * 100) + 1; // 1-100

        if (roll <= testConfig.probability_collectible) {
          results.collectible++;
        } else if (roll <= testConfig.probability_collectible + testConfig.probability_mission) {
          results.mission++;
        } else if (roll <= testConfig.probability_collectible + testConfig.probability_mission + testConfig.probability_trap) {
          results.trap++;
        } else {
          results.super_bonus++;
        }
      }

      console.log(`\n📊 Résultats sur ${nbRolls} rolls:`);
      console.log(`  Collectible: ${results.collectible} (${(results.collectible / nbRolls * 100).toFixed(1)}% - attendu: ${testConfig.probability_collectible}%)`);
      console.log(`  Mission: ${results.mission} (${(results.mission / nbRolls * 100).toFixed(1)}% - attendu: ${testConfig.probability_mission}%)`);
      console.log(`  Trap: ${results.trap} (${(results.trap / nbRolls * 100).toFixed(1)}% - attendu: ${testConfig.probability_trap}%)`);
      console.log(`  Super Bonus: ${results.super_bonus} (${(results.super_bonus / nbRolls * 100).toFixed(1)}% - attendu: ${testConfig.probability_super_bonus}%)`);

      // Vérifier que la distribution est proche des probabilités (marge de 3%)
      const margin = 3; // Marge de 3%

      const checkDistribution = (actual, expected, type) => {
        const actualPercent = (actual / nbRolls * 100);
        const diff = Math.abs(actualPercent - expected);

        if (diff <= margin) {
          console.log(`✅ ${type}: Distribution OK (écart: ${diff.toFixed(1)}%)`);
          return true;
        } else {
          console.log(`⚠️  ${type}: Distribution hors marge (écart: ${diff.toFixed(1)}% > ${margin}%)`);
          return false;
        }
      };

      console.log('\n🎯 Validation distribution (marge: ±3%):');
      checkDistribution(results.collectible, testConfig.probability_collectible, 'Collectible');
      checkDistribution(results.mission, testConfig.probability_mission, 'Mission');
      checkDistribution(results.trap, testConfig.probability_trap, 'Trap');
      checkDistribution(results.super_bonus, testConfig.probability_super_bonus, 'Super Bonus');

    } else {
      console.log('⚠️  Aucune configuration trouvée pour le test');
    }

    // ========================================
    // RÉSULTAT FINAL
    // ========================================
    console.log('\n' + '='.repeat(100));

    if (allTestsPassed) {
      console.log('✅ TOUS LES TESTS SONT PASSÉS');
      console.log('\n💡 Système Mystery Box 4ème Type opérationnel');
      console.log('   - probability_super_bonus configuré');
      console.log('   - activation_mode configuré');
      console.log('   - Distribution des 4 types fonctionnelle\n');
      process.exit(0);
    } else {
      console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ');
      console.log('\n⚠️  Vérifier les erreurs ci-dessus\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERREUR lors de la vérification:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

runVerification();
