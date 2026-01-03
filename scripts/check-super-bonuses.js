require('dotenv').config();
const db = require('../utils/database-pg');

async function main() {
  try {
    // D'abord, vérifier la structure de la table
    console.log('=== STRUCTURE DE LA TABLE SUPER_BONUSES ===\n');

    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      ORDER BY ordinal_position
    `);

    for (const col of columns) {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    }

    console.log('\n=== TOUS LES SUPER BONUS ===\n');

    const bonuses = await db.queryAll(`
      SELECT *
      FROM super_bonuses
      ORDER BY id
    `);

    console.log(`Total: ${bonuses.length} bonus\n`);

    for (const b of bonuses) {
      console.log(`ID: ${b.id}`);
      console.log(`   Nom: ${b.name}`);
      console.log(`   Effect Type: ${b.effect_type}`);
      console.log(`   Duration: ${b.duration_type} (${b.duration_value})`);
      console.log(`   Mode: ${b.activation_mode} | Enabled: ${b.is_enabled} | Rarity: ${b.rarity}`);
      if (b.effect_config) {
        console.log(`   Config: ${JSON.stringify(b.effect_config)}`);
      }
      console.log(`   Description: ${b.description}`);
      console.log('');
    }

    // Liste des effect_types distincts
    console.log('\n=== EFFECT TYPES DISTINCTS ===');
    const types = await db.queryAll('SELECT DISTINCT effect_type FROM super_bonuses');
    console.log(types.map(t => t.effect_type).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
