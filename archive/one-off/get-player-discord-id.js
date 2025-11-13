const db = require('./utils/database-pg');
require('dotenv').config();

async function getDiscordId() {
  try {
    const playerId = 109;
    const guildId = '1248028543389143070';

    const player = await db.queryOne(`
      SELECT * FROM players
      WHERE id = $1 AND guild_id = $2
    `, [playerId, guildId]);

    if (player) {
      console.log(`Player ID ${playerId}:`);
      console.log(`  Discord ID: ${player.discord_id}`);
      console.log(`  Username: ${player.username}`);
      console.log(`\nPour lancer le diagnostic:`);
      console.log(`node diagnose-trap-issue.js ${player.discord_id}`);
    } else {
      console.log('Joueur introuvable');
    }

    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

getDiscordId();
