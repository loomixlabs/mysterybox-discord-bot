/**
 * Migration: Ajouter les types de condition shame_nickname aux badges
 */

require('dotenv').config();
const db = require('../../utils/database-pg');

async function runMigration() {
  console.log('🎭 Migration: Ajout des types de condition Shame Nickname pour badges\n');
  console.log('='.repeat(60));

  try {
    // Supprimer l'ancienne contrainte
    await db.query('ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_condition_type_check');
    console.log('✅ Ancienne contrainte supprimée');

    // Ajouter la nouvelle contrainte avec les types shame
    await db.query(`
      ALTER TABLE badges ADD CONSTRAINT badges_condition_type_check
      CHECK (condition_type = ANY (ARRAY[
        'super_bonus_usage', 'super_bonus_unlock', 'collectible_count', 'rarity_collect',
        'mystery_box_open', 'trap_survive', 'trap_block', 'mission_complete', 'login_streak',
        'custom', 'crafting_upgrades', 'crafting_criticals', 'crafting_recycles',
        'legendary_count', 'epic_count', 'rare_count', 'evolution_level', 'max_level_count',
        'epic_box_open', 'legendary_box_open', 'all_rarities_opened', 'trap_triggered',
        'survive_lose_all', 'loomix_spent', 'loomix_earned', 'loomix_balance', 'days_active',
        'flex_count', 'favorites_set', 'first_mint', 'mint_first', 'mint_top_10', 'mint_100',
        'legendaries_in_24h', 'win_streak', 'blocks_in_24h', 'theme_completion', 'themes_completed',
        'fast_mission', 'perfect_quiz', 'wordle_first_try', 'flawless_missions', 'comeback_mission',
        'critical_streak', 'tictactoe_wins', 'tictactoe_games_played', 'tictactoe_win_streak',
        'tictactoe_clean_wins', 'tictactoe_fast_wins', 'tictactoe_draws', 'tictactoe_resilience',
        'tictactoe_patience', 'tictactoe_intimidation', 'tictactoe_total_moves', 'tictactoe_ratio',
        'shame_nickname_count', 'shame_escape_attempts', 'shame_total_minutes', 'shame_clown_count'
      ]))
    `);
    console.log('✅ Nouvelle contrainte ajoutée avec types shame');

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION TERMINÉE');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    process.exit(1);
  }
}

runMigration();
