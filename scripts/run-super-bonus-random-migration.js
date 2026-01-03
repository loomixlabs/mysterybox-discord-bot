/**
 * Migration: Ajouter super_bonus_random comme type de récompense daily
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function runMigration() {
  console.log('='.repeat(60));
  console.log('🔄 MIGRATION: Ajout super_bonus_random');
  console.log('='.repeat(60));

  try {
    // 1. Supprimer l'ancienne contrainte
    console.log('\n1. Suppression de l\'ancienne contrainte...');
    await db.query(`
      ALTER TABLE daily_rewards_config
      DROP CONSTRAINT IF EXISTS daily_rewards_config_reward_type_check
    `);
    console.log('   ✅ Contrainte supprimée');

    // 2. Recréer avec le nouveau type
    console.log('\n2. Création de la nouvelle contrainte...');
    await db.query(`
      ALTER TABLE daily_rewards_config
      ADD CONSTRAINT daily_rewards_config_reward_type_check
      CHECK(reward_type IN (
          'mystery_box',
          'points',
          'currency',
          'collectible',
          'random_collectible',
          'super_bonus',
          'super_bonus_random'
      ))
    `);
    console.log('   ✅ Nouvelle contrainte créée');

    // 3. Vérification
    console.log('\n3. Vérification...');
    const result = await db.queryOne(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'daily_rewards_config'::regclass
      AND conname = 'daily_rewards_config_reward_type_check'
    `);

    if (result) {
      console.log('   ✅ Contrainte vérifiée:');
      console.log(`   ${result.definition}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

runMigration();
