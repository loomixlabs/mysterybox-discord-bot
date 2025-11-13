const db = require('./utils/database-pg');

async function checkData() {
  const guildId = '297309737135898624';
  const userId = '169163391485149184'; // Votre Discord ID

  console.log('🔍 VÉRIFICATION DES DONNÉES\n');
  console.log('='.repeat(80));

  // Structure trap_triggered
  console.log('\n📋 Table: trap_triggered');
  const trapColumns = await db.queryAll(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'trap_triggered'
    ORDER BY ordinal_position
  `);
  console.table(trapColumns);

  // Vos données joueur
  console.log('\n👤 Votre profil joueur:');
  const player = await db.queryOne(`
    SELECT * FROM players
    WHERE guild_id = $1 AND discord_id = $2
  `, [guildId, userId]);
  console.table(player);

  // Votre progression
  console.log('\n📊 Votre progression:');
  const progress = await db.queryAll(`
    SELECT * FROM player_progress
    WHERE guild_id = $1 AND player_id = $2
  `, [guildId, player?.id]);
  console.table(progress);

  // Vos collectibles
  console.log('\n🎁 Vos collectibles:');
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
  `, [guildId, player?.id]);
  console.table(collections);

  // Vos missions
  console.log('\n🎯 Vos missions:');
  const missions = await db.queryAll(`
    SELECT
      mp.id,
      m.type,
      mp.status,
      mp.created_at,
      mp.completed_at
    FROM mission_progress mp
    JOIN missions m ON mp.mission_id = m.id
    WHERE mp.guild_id = $1 AND mp.player_id = $2
    ORDER BY mp.created_at DESC
  `, [guildId, player?.id]);
  console.table(missions);

  // Pièges déclenchés
  console.log('\n⚠️ Pièges déclenchés:');
  const traps = await db.queryAll(`
    SELECT * FROM trap_triggered
    WHERE guild_id = $1 AND player_id = $2
  `, [guildId, player?.id]);
  console.table(traps);

  // Structure player_malus_points
  console.log('\n📋 Table: player_malus_points');
  const malusColumns = await db.queryAll(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'player_malus_points'
    ORDER BY ordinal_position
  `);
  console.table(malusColumns);

  process.exit(0);
}

checkData();
