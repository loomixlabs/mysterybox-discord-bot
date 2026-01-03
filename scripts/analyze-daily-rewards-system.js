/**
 * Analyse complète du système Daily Rewards
 * - Structure des tables
 * - Contraintes existantes
 * - Types de récompenses supportés
 * - Tracking et logging
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function analyze() {
  console.log('='.repeat(80));
  console.log('🔍 ANALYSE COMPLÈTE DU SYSTÈME DAILY REWARDS');
  console.log('='.repeat(80));

  try {
    // 1. Structure de daily_rewards_config
    console.log('\n📋 1. TABLE: daily_rewards_config');
    console.log('-'.repeat(60));

    const configColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'daily_rewards_config'
      ORDER BY ordinal_position
    `);
    console.table(configColumns);

    // 2. Contraintes CHECK sur daily_rewards_config
    console.log('\n🔒 2. CONTRAINTES CHECK sur daily_rewards_config');
    console.log('-'.repeat(60));

    const configConstraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'daily_rewards_config'::regclass
      AND contype = 'c'
    `);
    if (configConstraints.length > 0) {
      configConstraints.forEach(c => {
        console.log(`  ${c.conname}:`);
        console.log(`    ${c.definition}\n`);
      });
    } else {
      console.log('  ⚠️  Aucune contrainte CHECK trouvée');
    }

    // 3. Structure de daily_claim_logs
    console.log('\n📋 3. TABLE: daily_claim_logs (Tracking)');
    console.log('-'.repeat(60));

    const logsColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'daily_claim_logs'
      ORDER BY ordinal_position
    `);
    if (logsColumns.length > 0) {
      console.table(logsColumns);
    } else {
      console.log('  ⚠️  Table daily_claim_logs n\'existe pas');
    }

    // 4. Structure de player_active_bonuses
    console.log('\n📋 4. TABLE: player_active_bonuses (Super Bonus actifs)');
    console.log('-'.repeat(60));

    const bonusColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);
    console.table(bonusColumns);

    // 5. Contrainte obtained_from sur player_active_bonuses
    console.log('\n🔒 5. CONTRAINTE obtained_from (sources autorisées)');
    console.log('-'.repeat(60));

    const obtainedFromConstraint = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'player_active_bonuses'::regclass
      AND contype = 'c'
      AND conname LIKE '%obtained_from%'
    `);
    if (obtainedFromConstraint.length > 0) {
      obtainedFromConstraint.forEach(c => {
        console.log(`  ${c.conname}:`);
        console.log(`    ${c.definition}\n`);
      });
    } else {
      console.log('  ⚠️  Aucune contrainte obtained_from trouvée');
    }

    // 6. Liste des super_bonuses disponibles
    console.log('\n⚡ 6. SUPER BONUSES DISPONIBLES');
    console.log('-'.repeat(60));

    const superBonuses = await db.queryAll(`
      SELECT id, name, effect_type, duration_type, is_active, rarity
      FROM super_bonuses
      WHERE is_active = TRUE
      ORDER BY rarity DESC, name
    `);
    console.table(superBonuses);

    // 7. Exemple de données daily_rewards_config existantes
    console.log('\n📊 7. EXEMPLE DE CONFIG EXISTANTE');
    console.log('-'.repeat(60));

    const sampleConfig = await db.queryAll(`
      SELECT day_number, reward_type, reward_rarity, reward_amount,
             reward_item_id, is_milestone, choice_options
      FROM daily_rewards_config
      ORDER BY theme_id, day_number
      LIMIT 10
    `);
    if (sampleConfig.length > 0) {
      console.table(sampleConfig);
    } else {
      console.log('  ⚠️  Aucune configuration existante');
    }

    // 8. Vérifier les types de sources dans collections
    console.log('\n📋 8. CONTRAINTE source sur collections');
    console.log('-'.repeat(60));

    const sourceConstraint = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'collections'::regclass
      AND contype = 'c'
      AND conname LIKE '%source%'
    `);
    if (sourceConstraint.length > 0) {
      sourceConstraint.forEach(c => {
        console.log(`  ${c.conname}:`);
        console.log(`    ${c.definition}\n`);
      });
    } else {
      console.log('  ⚠️  Aucune contrainte source trouvée');
    }

    // 9. Résumé des capacités
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ DES CAPACITÉS ACTUELLES');
    console.log('='.repeat(80));

    console.log(`
✅ TYPES DE RÉCOMPENSES POSSIBLES:

1. mystery_box (📦)
   - Clés de Mystery Box par rareté
   - Fonction: db.addMysteryBoxCredits()
   - Tracking: mystery_box_credit_logs

2. currency/points (💰)
   - Monnaie virtuelle (Loomix)
   - Fonction: db.addCurrency()
   - Tracking: currency_transactions

3. collectible (🎯) - À IMPLÉMENTER
   - Collectible spécifique par ID
   - Fonction: db.addCollectible()
   - Tracking: collections.source = 'daily_claim'

4. random_collectible (🎲) - À IMPLÉMENTER
   - Collectible aléatoire du thème
   - Fonction: db.addCollectible()
   - Tracking: collections.source = 'daily_claim'

5. super_bonus (⚡) - À IMPLÉMENTER
   - Super bonus spécifique par ID
   - Fonction: db.addBonusToPlayer()
   - Tracking: player_active_bonuses.obtained_from = 'daily_claim'

6. super_bonus_random (🌀) - À AJOUTER & IMPLÉMENTER
   - Super bonus aléatoire
   - Fonction: db.addBonusToPlayer()
   - Tracking: player_active_bonuses.obtained_from = 'daily_claim'

7. choice (🎁) - À IMPLÉMENTER
   - Le joueur choisit parmi plusieurs options
   - Stocké dans choice_options (JSONB)
`);

    // 10. Vérifier si daily_claim existe dans obtained_from
    console.log('\n🔍 10. VÉRIFICATION: daily_claim dans les contraintes sources');
    console.log('-'.repeat(60));

    const allConstraints = await db.queryAll(`
      SELECT c.conrelid::regclass as table_name, c.conname, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      WHERE contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%daily_claim%'
    `);

    if (allConstraints.length > 0) {
      console.log('  Tables avec daily_claim autorisé:');
      allConstraints.forEach(c => {
        console.log(`    - ${c.table_name}: ${c.conname}`);
      });
    } else {
      console.log('  ⚠️  daily_claim n\'est dans AUCUNE contrainte source!');
      console.log('  → Il faudra modifier les contraintes de:');
      console.log('    - player_active_bonuses.obtained_from');
      console.log('    - collections.source');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyze();
