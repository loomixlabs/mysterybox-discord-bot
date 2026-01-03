/**
 * Vérification de la structure de player_progress
 */

const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 Vérification structure player_progress');
  console.log('='.repeat(60));

  try {
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Colonnes de player_progress:');
    for (const col of columns) {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }

    const hasAchievedRoles = columns.some(c => c.column_name === 'achieved_progression_roles');

    console.log('\n' + '='.repeat(60));
    if (hasAchievedRoles) {
      console.log('✅ La colonne achieved_progression_roles EXISTE');
    } else {
      console.log('❌ La colonne achieved_progression_roles MANQUE!');
      console.log('\n🔧 MIGRATION REQUISE:');
      console.log('   ALTER TABLE player_progress ADD COLUMN achieved_progression_roles INTEGER[] DEFAULT \'{}\';');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

check();
