const db = require('./utils/database-pg');
require('dotenv').config();

async function checkTraps() {
  try {
    const guildId = '1248028543389143070';

    console.log('🔍 Structure et contenu de la table traps...\n');

    // Structure
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'traps'
      ORDER BY ordinal_position
    `);

    console.log('📊 Structure de la table:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // Traps existants
    const traps = await db.queryAll(`
      SELECT * FROM traps WHERE guild_id = $1
    `, [guildId]);

    console.log(`\n🎭 Pièges existants (${traps.length}):\n`);
    traps.forEach(trap => {
      console.log(`ID: ${trap.id}`);
      console.log(`  Nom: ${trap.name}`);
      console.log(`  Type: ${trap.type}`);
      console.log(`  Description: ${trap.description}`);
      console.log(`  Actif: ${trap.is_active}`);
      console.log(`  Theme ID: ${trap.theme_id}`);
      if (trap.cooldown_duration) console.log(`  Cooldown: ${trap.cooldown_duration} minutes`);
      if (trap.malus_points) console.log(`  Malus points: ${trap.malus_points}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkTraps();
