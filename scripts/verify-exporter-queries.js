/**
 * Vérifie que les requêtes SELECT de themeExporter.js utilisent des colonnes existantes
 */

require('dotenv').config();
const db = require('../utils/database-pg');

// Les colonnes que themeExporter.js attend de récupérer (basé sur formatXxx())
const EXPORTER_EXPECTED_COLUMNS = {
  themes: ['id', 'theme_id', 'name', 'duration_days', 'required_items', 'final_role_name', 'final_role_color', 'is_active', 'created_at'],
  theme_config: [
    'probability_collectible', 'probability_mission', 'probability_trap', 'probability_super_bonus',
    'collectible_rarity_legendary', 'collectible_rarity_epic', 'collectible_rarity_rare', 'collectible_rarity_common',
    'super_bonus_rarity_legendary', 'super_bonus_rarity_epic', 'super_bonus_rarity_rare', 'super_bonus_rarity_common',
    'mystery_box_image', 'mystery_box_title', 'mystery_box_description', 'mystery_box_winner_message',
    'mystery_box_celebration_gif', 'mystery_box_celebration_emojis', 'auto_delete_celebration_message'
  ],
  collectibles: ['collectible_id', 'name', 'image_url', 'rarity', 'reveal_message'],
  traps: [
    'trap_id', 'name', 'type', 'description', 'image_url', 'cooldown_duration',
    'removes_collectible', 'shame_message', 'malus_points', 'is_default', 'is_active',
    'notif_title', 'notif_description', 'notif_color', 'notif_footer'
  ],
  missions: ['id', 'mission_id', 'name', 'type', 'description', 'validation_type', 'timeout', 'image_url', 'reward_type', 'max_attempts'],
  mission_keywords: ['keyword', 'difficulty'],
  quiz_questions: ['question_text', 'correct_answer', 'wrong_answers', 'hint', 'difficulty'],
  theme_messages: ['key', 'content']
};

async function getDbColumns(tableName) {
  const columns = await db.queryAll(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return columns.map(c => c.column_name);
}

async function verifyTable(tableName) {
  console.log(`\n📋 Table: ${tableName}`);
  console.log('-'.repeat(50));

  const dbColumns = await getDbColumns(tableName);
  const expectedColumns = EXPORTER_EXPECTED_COLUMNS[tableName] || [];

  // Vérifier que toutes les colonnes attendues existent
  const missing = expectedColumns.filter(c => !dbColumns.includes(c));

  if (missing.length > 0) {
    console.log(`❌ Colonnes manquantes dans DB: ${missing.join(', ')}`);
    return false;
  }

  console.log(`✅ Toutes les ${expectedColumns.length} colonnes existent dans DB`);
  console.log(`   Colonnes: ${expectedColumns.join(', ')}`);
  return true;
}

async function main() {
  console.log('🔍 VÉRIFICATION: themeExporter.js vs Structure DB');
  console.log('='.repeat(60));

  let allValid = true;
  const tables = Object.keys(EXPORTER_EXPECTED_COLUMNS);

  for (const table of tables) {
    const valid = await verifyTable(table);
    if (!valid) allValid = false;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));

  if (allValid) {
    console.log('\n✅✅✅ EXPORTER VALIDE - TOUTES LES COLONNES EXISTENT ✅✅✅');
  } else {
    console.log('\n❌❌❌ DES COLONNES SONT MANQUANTES ❌❌❌');
  }

  process.exit(allValid ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
