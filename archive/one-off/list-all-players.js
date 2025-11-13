const db = require('./utils/database-pg');
require('dotenv').config();

async function listAllPlayers() {
  try {
    const guildId = '1248028543389143070';

    console.log('📋 LISTE DE TOUS LES JOUEURS\n');

    const players = await db.queryAll(`
      SELECT id, username, discord_id, created_at
      FROM players
      WHERE guild_id = $1
      ORDER BY created_at DESC
    `, [guildId]);

    console.log(`Total: ${players.length} joueurs\n`);

    for (const player of players) {
      console.log(`────────────────────────────────────────`);
      console.log(`👤 ${player.username}`);
      console.log(`   Discord ID: ${player.discord_id}`);
      console.log(`   Player ID: ${player.id}`);
      console.log(`   Inscrit: ${new Date(player.created_at).toLocaleString('fr-FR')}`);

      // Compter les collectibles actifs
      const collectibles = await db.queryOne(`
        SELECT COUNT(*) as total FROM collections
        WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
      `, [guildId, player.id]);

      // Compter les collectibles perdus
      const lost = await db.queryOne(`
        SELECT COUNT(*) as total FROM collections
        WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NOT NULL
      `, [guildId, player.id]);

      // Compter les missions complétées
      const missions = await db.queryOne(`
        SELECT COUNT(*) as total FROM mission_progress
        WHERE guild_id = $1 AND player_id = $2 AND status = 'completed'
      `, [guildId, player.id]);

      console.log(`   📦 Collectibles: ${collectibles.total} actifs, ${lost.total} perdus`);
      console.log(`   ✅ Missions complétées: ${missions.total}`);
    }

    console.log('\n────────────────────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

listAllPlayers();
