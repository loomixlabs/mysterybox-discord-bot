/**
 * Script de vérification détaillée: Implémentation vs Structure DB Réelle
 * Compare module par module les colonnes utilisées dans themeImporter/Exporter
 * avec la structure réelle de la base de données
 */

require('dotenv').config();
const db = require('../utils/database-pg');

// Colonnes utilisées dans themeImporter.js
const IMPORTER_COLUMNS = {
  themes: [
    'guild_id', 'theme_id', 'name', 'duration_days', 'required_items',
    'final_role_name', 'final_role_color', 'is_active', 'created_at'
  ],
  theme_config: [
    'guild_id', 'theme_id',
    'probability_collectible', 'probability_mission', 'probability_trap', 'probability_super_bonus',
    'collectible_rarity_legendary', 'collectible_rarity_epic', 'collectible_rarity_rare', 'collectible_rarity_common',
    'super_bonus_rarity_legendary', 'super_bonus_rarity_epic', 'super_bonus_rarity_rare', 'super_bonus_rarity_common',
    'mystery_box_image', 'mystery_box_title', 'mystery_box_description',
    'mystery_box_winner_message', 'mystery_box_celebration_gif', 'mystery_box_celebration_emojis',
    'auto_delete_celebration_message'
  ],
  collectibles: [
    'guild_id', 'theme_id', 'collectible_id', 'name', 'image_url', 'rarity', 'reveal_message', 'created_at'
  ],
  traps: [
    'guild_id', 'theme_id', 'trap_id', 'name', 'type', 'description', 'image_url',
    'cooldown_duration', 'removes_collectible', 'shame_message', 'malus_points',
    'is_default', 'is_active', 'notif_title', 'notif_description', 'notif_color', 'notif_footer', 'created_at'
  ],
  missions: [
    'guild_id', 'theme_id', 'mission_id', 'name', 'type', 'description',
    'validation_type', 'timeout', 'image_url', 'reward_type', 'max_attempts', 'created_at'
  ],
  mission_keywords: [
    'guild_id', 'mission_id', 'keyword', 'difficulty', 'created_at'
  ],
  quiz_questions: [
    'guild_id', 'theme_id', 'question_text', 'correct_answer', 'wrong_answers', 'hint', 'difficulty', 'created_at'
  ],
  theme_messages: [
    'guild_id', 'theme_id', 'key', 'content'
  ]
};

async function getDbColumns(tableName) {
  const columns = await db.queryAll(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return columns;
}

async function getConstraints(tableName) {
  const checks = await db.queryAll(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = $1::regclass AND contype = 'c'
  `, [tableName]);
  return checks;
}

async function verifyTable(tableName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 MODULE: ${tableName.toUpperCase()}`);
  console.log('='.repeat(80));

  const dbColumns = await getDbColumns(tableName);
  const importerColumns = IMPORTER_COLUMNS[tableName] || [];

  const dbColumnNames = dbColumns.map(c => c.column_name);

  console.log(`\n📊 Colonnes DB (${dbColumnNames.length}):`);
  console.log(`   ${dbColumnNames.join(', ')}`);

  console.log(`\n📝 Colonnes Importer (${importerColumns.length}):`);
  console.log(`   ${importerColumns.join(', ')}`);

  // Vérification 1: Colonnes dans Importer mais PAS dans DB
  const missingInDb = importerColumns.filter(c => !dbColumnNames.includes(c));
  if (missingInDb.length > 0) {
    console.log(`\n❌ ERREUR: Colonnes utilisées dans Importer mais ABSENTES de la DB:`);
    missingInDb.forEach(c => console.log(`   - ${c}`));
  } else {
    console.log(`\n✅ Toutes les colonnes de l'Importer existent dans la DB`);
  }

  // Vérification 2: Colonnes dans DB mais PAS dans Importer (info seulement)
  const missingInImporter = dbColumnNames.filter(c => !importerColumns.includes(c));
  if (missingInImporter.length > 0) {
    console.log(`\n⚠️  Colonnes DB non utilisées par l'Importer (optionnelles?):`);
    missingInImporter.forEach(c => {
      const col = dbColumns.find(dc => dc.column_name === c);
      const nullable = col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL';
      const hasDefault = col.column_default ? `default: ${col.column_default.substring(0, 30)}` : 'pas de default';
      console.log(`   - ${c} (${col.data_type}, ${nullable}, ${hasDefault})`);
    });
  }

  // Vérification 3: Contraintes CHECK
  const constraints = await getConstraints(tableName);
  if (constraints.length > 0) {
    console.log(`\n⚙️  Contraintes CHECK à respecter (${constraints.length}):`);
    constraints.forEach(c => {
      console.log(`   - ${c.conname}: ${c.definition}`);
    });
  }

  // Retour du résultat
  return {
    table: tableName,
    valid: missingInDb.length === 0,
    missingInDb,
    missingInImporter,
    constraints: constraints.map(c => c.definition)
  };
}

async function main() {
  console.log('🔍 VÉRIFICATION DÉTAILLÉE: IMPLÉMENTATION vs STRUCTURE DB RÉELLE');
  console.log('='.repeat(80));
  console.log(`📅 Date: ${new Date().toISOString()}`);

  const tables = Object.keys(IMPORTER_COLUMNS);
  const results = [];

  for (const table of tables) {
    try {
      const result = await verifyTable(table);
      results.push(result);
    } catch (error) {
      console.log(`\n❌ Erreur pour ${table}: ${error.message}`);
      results.push({ table, valid: false, error: error.message });
    }
  }

  // Résumé final
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ FINAL');
  console.log('='.repeat(80));

  let allValid = true;
  for (const result of results) {
    if (result.valid) {
      console.log(`✅ ${result.table}: OK`);
    } else if (result.error) {
      console.log(`❌ ${result.table}: ERREUR - ${result.error}`);
      allValid = false;
    } else {
      console.log(`❌ ${result.table}: COLONNES MANQUANTES - ${result.missingInDb.join(', ')}`);
      allValid = false;
    }
  }

  if (allValid) {
    console.log('\n✅✅✅ TOUTES LES VÉRIFICATIONS PASSENT ✅✅✅');
  } else {
    console.log('\n❌❌❌ DES CORRECTIONS SONT NÉCESSAIRES ❌❌❌');
  }

  process.exit(allValid ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
