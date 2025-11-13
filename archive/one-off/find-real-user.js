const db = require('./utils/database-pg');

async function findUser() {
  const guildId = '297309737135898624';

  console.log('🔍 RECHERCHE DU JOUEUR player_id=1\n');
  console.log('='.repeat(80));

  // Trouver le joueur avec player_id=1
  const player = await db.queryOne(`
    SELECT * FROM players
    WHERE guild_id = $1 AND id = 1
  `, [guildId]);

  console.log('\n👤 Joueur trouvé:');
  console.table(player);

  if (player) {
    // Ses collections
    console.log('\n🎁 Ses collectibles:');
    const collections = await db.queryAll(`
      SELECT
        c.id,
        col.name,
        col.rarity,
        c.source,
        c.collected_at
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2
      ORDER BY c.collected_at DESC
      LIMIT 10
    `, [guildId, player.id]);
    console.table(collections);

    // Sa progression
    console.log('\n📊 Sa progression:');
    const progress = await db.queryAll(`
      SELECT * FROM player_progress
      WHERE guild_id = $1 AND player_id = $2
    `, [guildId, player.id]);
    console.table(progress);
  }

  process.exit(0);
}

findUser();
