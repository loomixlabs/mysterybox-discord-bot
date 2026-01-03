/**
 * Vérifie toutes les guilds avec le thème testv4
 */
require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
  console.log('=== GUILDS AVEC THEME testv4 ===\n');

  const themes = await db.queryAll("SELECT guild_id, name, is_active FROM themes WHERE name = 'testv4'");
  console.log('Thèmes trouvés:');
  console.table(themes);

  for (const t of themes) {
    const players = await db.queryOne('SELECT COUNT(*) as count FROM players WHERE guild_id = $1', [t.guild_id]);
    const collections = await db.queryOne('SELECT COUNT(*) as count FROM collections WHERE guild_id = $1 AND lost_at IS NULL', [t.guild_id]);
    const logs = await db.queryOne('SELECT COUNT(*) as count FROM give_logs WHERE guild_id = $1', [t.guild_id]);

    console.log(`\nGuild ${t.guild_id} (active: ${t.is_active}):`);
    console.log('  - Joueurs:', players?.count || 0);
    console.log('  - Collections:', collections?.count || 0);
    console.log('  - Give logs:', logs?.count || 0);
  }

  process.exit(0);
}

check();
