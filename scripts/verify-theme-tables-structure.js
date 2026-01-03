/**
 * Script de vérification des tables liées aux thèmes
 * Vérifie la structure réelle de la DB avant import/export
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const TABLES_TO_CHECK = [
  'themes',
  'theme_config',
  'collectibles',
  'traps',
  'missions',
  'mission_keywords',
  'quiz_questions',
  'theme_messages'
];

async function verifyTableStructure(tableName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 TABLE: ${tableName}`);
  console.log('='.repeat(60));

  try {
    // Récupérer les colonnes
    const columns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    if (columns.length === 0) {
      console.log(`❌ Table "${tableName}" non trouvée ou vide`);
      return null;
    }

    console.log(`\n📊 Colonnes (${columns.length}):\n`);
    columns.forEach((col, i) => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
      const defaultVal = col.column_default ? ` DEFAULT: ${col.column_default.substring(0, 40)}` : '';
      const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`  ${i + 1}. ${col.column_name.padEnd(30)} ${col.data_type}${maxLen} ${nullable}${defaultVal}`);
    });

    // Récupérer les contraintes CHECK
    const checks = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'c'
    `, [tableName]);

    if (checks.length > 0) {
      console.log(`\n⚠️  Contraintes CHECK (${checks.length}):`);
      checks.forEach(c => {
        console.log(`  - ${c.conname}: ${c.definition}`);
      });
    }

    // Récupérer les contraintes UNIQUE
    const uniques = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'u'
    `, [tableName]);

    if (uniques.length > 0) {
      console.log(`\n🔑 Contraintes UNIQUE (${uniques.length}):`);
      uniques.forEach(u => {
        console.log(`  - ${u.conname}: ${u.definition}`);
      });
    }

    // Compter les enregistrements pour le guild actuel
    const guildId = process.env.GUILD_ID || '1248028543389143070';
    let count = 0;
    try {
      const hasGuildId = columns.some(c => c.column_name === 'guild_id');
      if (hasGuildId) {
        const countResult = await db.queryOne(`SELECT COUNT(*) as count FROM ${tableName} WHERE guild_id = $1`, [guildId]);
        count = parseInt(countResult.count);
      } else {
        const countResult = await db.queryOne(`SELECT COUNT(*) as count FROM ${tableName}`);
        count = parseInt(countResult.count);
      }
      console.log(`\n📈 Enregistrements (guild ${guildId}): ${count}`);
    } catch (e) {
      console.log(`\n📈 Enregistrements: Erreur - ${e.message}`);
    }

    return {
      tableName,
      columns: columns.map(c => c.column_name),
      checks: checks.map(c => c.definition),
      uniques: uniques.map(u => u.definition),
      count
    };

  } catch (error) {
    console.error(`❌ Erreur pour ${tableName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 VÉRIFICATION STRUCTURE DES TABLES THÈMES');
  console.log('='.repeat(60));
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🎯 Guild ID: ${process.env.GUILD_ID || '1248028543389143070'}`);

  const results = {};

  for (const table of TABLES_TO_CHECK) {
    results[table] = await verifyTableStructure(table);
  }

  // Résumé
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));

  for (const [table, data] of Object.entries(results)) {
    if (data) {
      console.log(`✅ ${table}: ${data.columns.length} colonnes, ${data.count} enregistrements`);
    } else {
      console.log(`❌ ${table}: Non trouvée`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
