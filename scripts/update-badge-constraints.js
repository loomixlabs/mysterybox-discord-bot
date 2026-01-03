/**
 * Script pour mettre à jour les contraintes CHECK de la table badges
 * pour supporter les nouvelles catégories et condition_types V2
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function updateConstraints() {
  console.log('🔧 Mise à jour des contraintes CHECK sur badges...\n');

  try {
    // 1. Supprimer l'ancienne contrainte category_check
    console.log('1. Suppression de badges_category_check...');
    await db.query('ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_category_check');
    console.log('   ✅ Supprimée');

    // 2. Ajouter la nouvelle contrainte category avec toutes les catégories
    console.log('2. Création de la nouvelle contrainte badges_category_check...');
    await db.query(`
      ALTER TABLE badges ADD CONSTRAINT badges_category_check
      CHECK (category IN (
        'super_bonus', 'collection', 'rarity', 'mystery_box', 'trap',
        'mission', 'engagement', 'social', 'special', 'crafting',
        'evolution', 'economy', 'seniority', 'luck', 'mint', 'theme'
      ))
    `);
    console.log('   ✅ Créée avec 16 catégories');

    // 3. Supprimer l'ancienne contrainte condition_type_check
    console.log('3. Suppression de badges_condition_type_check...');
    await db.query('ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_condition_type_check');
    console.log('   ✅ Supprimée');

    // 4. Ajouter la nouvelle contrainte condition_type avec tous les types
    console.log('4. Création de la nouvelle contrainte badges_condition_type_check...');
    await db.query(`
      ALTER TABLE badges ADD CONSTRAINT badges_condition_type_check
      CHECK (condition_type IN (
        -- Types existants de base
        'super_bonus_usage', 'super_bonus_unlock', 'collectible_count',
        'rarity_collect', 'mystery_box_open', 'trap_survive', 'trap_block',
        'mission_complete', 'login_streak', 'custom',
        'crafting_upgrades', 'crafting_criticals', 'crafting_recycles',
        -- Types V2 - Rareté
        'legendary_count', 'epic_count', 'rare_count',
        -- Types V2 - Évolution
        'evolution_level', 'max_level_count',
        -- Types V2 - Mystery Box rareté
        'epic_box_open', 'legendary_box_open', 'all_rarities_opened',
        -- Types V2 - Pièges
        'trap_triggered', 'survive_lose_all',
        -- Types V2 - Économie
        'loomix_spent', 'loomix_earned', 'loomix_balance',
        -- Types V2 - Ancienneté
        'days_active',
        -- Types V2 - Social
        'flex_count', 'favorites_set',
        -- Types V2 - Mint (les deux variantes pour compatibilité)
        'first_mint', 'mint_first', 'mint_top_10', 'mint_100',
        -- Types V2 - Chance
        'legendaries_in_24h', 'win_streak', 'blocks_in_24h',
        -- Types V2 - Thème
        'theme_completion',
        -- Types V2 - Mission spéciale
        'fast_mission', 'perfect_quiz', 'wordle_first_try', 'flawless_missions',
        'comeback_mission', 'critical_streak'
      ))
    `);
    console.log('   ✅ Créée avec tous les nouveaux types');

    // Vérification finale
    console.log('\n📋 Vérification des contraintes actuelles...');
    const constraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'badges'::regclass
      AND contype = 'c'
    `);

    console.log('\nContraintes CHECK actives:');
    constraints.forEach(c => {
      console.log(`\n${c.conname}:`);
      console.log(`${c.definition}`);
    });

    console.log('\n✅ Mise à jour terminée avec succès !');
    console.log('\nVous pouvez maintenant exécuter: node scripts/seed-badges-v2-complete.js');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }

  process.exit(0);
}

updateConstraints();
