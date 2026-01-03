require('dotenv').config();
const db = require('../utils/database-pg');

async function main() {
  try {
    // Structure de la table player_cooldowns
    console.log('=== STRUCTURE TABLE PLAYER_COOLDOWNS ===\n');

    const cols = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_cooldowns'
      ORDER BY ordinal_position
    `);

    for (const c of cols) {
      console.log(`  ${c.column_name}: ${c.data_type}`);
    }

    // Exemples de cooldowns actifs
    console.log('\n=== COOLDOWNS ACTIFS (exemples) ===\n');

    const cooldowns = await db.queryAll(`
      SELECT pc.*, p.discord_id, p.username
      FROM player_cooldowns pc
      JOIN players p ON pc.player_id = p.id AND pc.guild_id = p.guild_id
      WHERE pc.expires_at > NOW()
      LIMIT 10
    `);

    console.log(`Total actifs trouvés: ${cooldowns.length}`);
    for (const cd of cooldowns) {
      console.log(`  Player: ${cd.username} | Type: ${cd.cooldown_type} | Expires: ${cd.expires_at}`);
    }

    // Types de cooldowns distincts
    console.log('\n=== TYPES DE COOLDOWNS DISTINCTS ===\n');

    const types = await db.queryAll('SELECT DISTINCT cooldown_type FROM player_cooldowns');
    console.log(types.map(t => t.cooldown_type).join(', ') || 'Aucun');

    // Chercher où les cooldowns sont utilisés dans le code
    console.log('\n=== DURÉES DES COOLDOWNS (estimation) ===\n');

    // Regarder les cooldowns récents pour estimer les durées
    const recentCooldowns = await db.queryAll(`
      SELECT cooldown_type,
             EXTRACT(EPOCH FROM (expires_at - created_at)) as duration_seconds,
             COUNT(*) as count
      FROM player_cooldowns
      GROUP BY cooldown_type, EXTRACT(EPOCH FROM (expires_at - created_at))
      ORDER BY cooldown_type, count DESC
    `);

    for (const rc of recentCooldowns) {
      const hours = Math.floor(rc.duration_seconds / 3600);
      const minutes = Math.floor((rc.duration_seconds % 3600) / 60);
      console.log(`  ${rc.cooldown_type}: ${hours}h ${minutes}min (${rc.count} occurrences)`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
