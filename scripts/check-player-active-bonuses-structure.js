const db = require('../utils/database-pg');

async function checkStructure() {
  console.log('\n🔍 STRUCTURE - Table player_active_bonuses\n');
  console.log('='.repeat(80));

  try {
    // Structure de la table
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Colonnes de player_active_bonuses:\n');
    console.table(columns);

    // Exemples de données récentes
    console.log('\n📊 EXEMPLES DE DONNÉES RÉCENTES:\n');
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    const recent = await db.queryAll(`
      SELECT *
      FROM player_active_bonuses
      WHERE guild_id = $1
      ORDER BY id DESC
      LIMIT 5
    `, [guildId]);

    if (recent.length > 0) {
      console.table(recent);
    } else {
      console.log('⚠️  Aucune donnée récente');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkStructure();
