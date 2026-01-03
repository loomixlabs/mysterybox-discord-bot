const db = require('../utils/database-pg');

/**
 * ANALYSE DU SYSTÈME DE PROBABILITÉS MYSTERY BOX
 *
 * Objectifs:
 * 1. Analyser la structure actuelle des probabilités (3 types)
 * 2. Identifier où ajouter le 4ème type (super_bonus)
 * 3. Analyser le système de probabilités par rareté (à créer)
 * 4. Vérifier la configuration dans admin panel
 */

async function analyzeProbabilities() {
  console.log('\n🎲 ANALYSE SYSTÈME DE PROBABILITÉS\n');
  console.log('='.repeat(120));

  try {
    // ========== 1. CONFIGURATION ACTUELLE ==========
    console.log('\n📊 1. CONFIGURATION ACTUELLE DES PROBABILITÉS');
    console.log('-'.repeat(120));

    const configs = await db.queryAll(`
      SELECT
        tc.guild_id,
        t.name as theme_name,
        tc.probability_collectible,
        tc.probability_mission,
        tc.probability_trap
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE t.is_active = true
      LIMIT 5
    `);

    if (configs.length > 0) {
      console.log('\n✅ Configurations trouvées (thèmes actifs):');
      console.table(configs);

      // Vérifier si la somme = 100%
      for (const config of configs) {
        const total = config.probability_collectible + config.probability_mission + config.probability_trap;
        console.log(`\n${config.theme_name} (${config.guild_id}):`);
        console.log(`   Collectible: ${config.probability_collectible}%`);
        console.log(`   Mission: ${config.probability_mission}%`);
        console.log(`   Trap: ${config.probability_trap}%`);
        console.log(`   TOTAL: ${total}% ${total === 100 ? '✅' : `❌ (devrait être 100%)`}`);
      }
    } else {
      console.log('\n⚠️  Aucune configuration de probabilités trouvée');
    }

    // ========== 2. STRUCTURE THEME_CONFIG ==========
    console.log('\n\n📋 2. STRUCTURE TABLE THEME_CONFIG');
    console.log('-'.repeat(120));

    const themeConfigColumns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      ORDER BY ordinal_position
    `);

    console.log('\n✅ Colonnes de theme_config:');
    console.table(themeConfigColumns);

    // ========== 3. PROBABILITÉS PAR RARETÉ (À CRÉER) ==========
    console.log('\n\n💎 3. SYSTÈME DE PROBABILITÉS PAR RARETÉ');
    console.log('-'.repeat(120));

    console.log('\n⚠️  ACTUELLEMENT: Probabilités par rareté NON IMPLÉMENTÉES');
    console.log('\n📋 Ce qui existe:');
    console.log('   • probability_collectible (global pour TOUS les collectibles)');
    console.log('   • Sélection aléatoire parmi collectibles disponibles (sans pondération rareté)');

    console.log('\n🎯 Ce qui manque:');
    console.log('   • Probabilités spécifiques par rareté (legendary, epic, rare, common)');
    console.log('   • Configuration dans admin panel "Gérer les Collectibles"');
    console.log('   • Stockage en DB (nouvelle table ou colonnes dans theme_config)');

    console.log('\n💡 Options d\'implémentation:');
    console.log('\n   Option A: Colonnes dans theme_config');
    console.log('      - probability_rarity_legendary (ex: 10%)');
    console.log('      - probability_rarity_epic (ex: 20%)');
    console.log('      - probability_rarity_rare (ex: 30%)');
    console.log('      - probability_rarity_common (ex: 40%)');
    console.log('      - Total = 100%');

    console.log('\n   Option B: Table séparée rarity_probabilities');
    console.log('      - guild_id, theme_id, rarity, probability');
    console.log('      - Plus flexible pour ajouter de nouvelles raretés');

    console.log('\n   👉 RECOMMANDATION: Option A (plus simple, intégré dans theme_config)');

    // ========== 4. AJOUT SUPER BONUS (4ème TYPE) ==========
    console.log('\n\n🎁 4. AJOUT SUPER BONUS COMME 4ème TYPE');
    console.log('-'.repeat(120));

    console.log('\n📋 Actuellement (3 types):');
    console.log('   • Collectible: 40% par défaut');
    console.log('   • Mission: 40% par défaut');
    console.log('   • Trap: 20% par défaut');
    console.log('   • TOTAL: 100%');

    console.log('\n🎯 Avec Super Bonus (4 types):');
    console.log('   • Collectible: 35% (nouvelle valeur par défaut)');
    console.log('   • Mission: 35%');
    console.log('   • Trap: 20%');
    console.log('   • Super Bonus: 10% (NOUVEAU !) 🎁');
    console.log('   • TOTAL: 100%');

    console.log('\n🔧 Modifications nécessaires:');
    console.log('   1. Migration SQL: ALTER TABLE theme_config ADD COLUMN probability_super_bonus INTEGER DEFAULT 10');
    console.log('   2. Migration données: UPDATE theme_config SET probability_collectible = 35, probability_mission = 35 WHERE probability_super_bonus IS NULL');
    console.log('   3. Modifier rollMysteryContent() dans mysteryBoxHandler.js');
    console.log('   4. Ajouter interface dans admin panel (configurer les 4 probabilités)');
    console.log('   5. Validation: Total = 100%');

    // ========== 5. ADMIN PANEL CONFIGURATION ==========
    console.log('\n\n⚙️  5. CONFIGURATION DANS ADMIN PANEL');
    console.log('-'.repeat(120));

    console.log('\n📋 Emplacements de configuration:');
    console.log('   • /admin-panel → Configuration Thème → Probabilités Mystery Box');
    console.log('   • /admin-panel → Gérer les Collectibles → [NOUVEAU] Probabilités par Rareté');

    console.log('\n🔧 Interface Probabilités Mystery Box (à modifier):');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ 🎲 PROBABILITÉS MYSTERY BOX             │');
    console.log('   ├─────────────────────────────────────────┤');
    console.log('   │ 🎭 Collectible:  [35] %                 │');
    console.log('   │ 📋 Mission:      [35] %                 │');
    console.log('   │ ⚠️  Trap:         [20] %                 │');
    console.log('   │ 🎁 Super Bonus:  [10] % [NOUVEAU]       │');
    console.log('   │                                         │');
    console.log('   │ ✅ Total: 100%                          │');
    console.log('   │                                         │');
    console.log('   │ [Sauvegarder]  [Réinitialiser]          │');
    console.log('   └─────────────────────────────────────────┘');

    console.log('\n🔧 Interface Probabilités par Rareté (à créer):');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ 💎 PROBABILITÉS PAR RARETÉ              │');
    console.log('   ├─────────────────────────────────────────┤');
    console.log('   │ 🌟 Légendaire:   [10] %                 │');
    console.log('   │ 💜 Épique:       [20] %                 │');
    console.log('   │ 💙 Rare:         [30] %                 │');
    console.log('   │ ⚪ Commun:       [40] %                 │');
    console.log('   │                                         │');
    console.log('   │ ✅ Total: 100%                          │');
    console.log('   │                                         │');
    console.log('   │ [Sauvegarder]  [Réinitialiser]          │');
    console.log('   └─────────────────────────────────────────┘');

    // ========== 6. RÉSUMÉ ET RECOMMANDATIONS ==========
    console.log('\n\n📋 6. RÉSUMÉ ET PLAN D\'IMPLÉMENTATION');
    console.log('='.repeat(120));

    console.log('\n✅ EXISTANT:');
    console.log('   • Table theme_config avec 3 probabilités (collectible, mission, trap)');
    console.log('   • Interface admin pour configurer ces 3 probabilités');
    console.log('   • Méthode rollMysteryContent() qui utilise ces probabilités');

    console.log('\n🎯 À IMPLÉMENTER - Phase 1 (Super Bonus):');
    console.log('   1. Migration: Ajouter colonne probability_super_bonus (2h)');
    console.log('   2. Modifier rollMysteryContent() pour gérer 4 types (3h)');
    console.log('   3. Créer selectSuperBonus() pour tirer un bonus aléatoire (2h)');
    console.log('   4. Modifier interface admin panel (2h)');
    console.log('   5. Tests end-to-end (2h)');
    console.log('   📊 TOTAL Phase 1: ~11h');

    console.log('\n💎 À IMPLÉMENTER - Phase 2 (Probabilités par Rareté):');
    console.log('   1. Migration: Ajouter 4 colonnes rarity probability (1h)');
    console.log('   2. Modifier selectCollectibleByRarity() pour pondération (4h)');
    console.log('   3. Créer interface admin "Probabilités par Rareté" (3h)');
    console.log('   4. Validation + tests (2h)');
    console.log('   📊 TOTAL Phase 2: ~10h');

    console.log('\n' + '='.repeat(120));
    console.log('✅ Analyse terminée\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'analyse:', error);
    process.exit(1);
  }
}

analyzeProbabilities();
