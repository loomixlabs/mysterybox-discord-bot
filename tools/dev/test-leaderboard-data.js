const db = require('./utils/database-pg');

async function testLeaderboard() {
  console.log('🔍 TEST LEADERBOARD - Diagnostic\n');
  console.log('='.repeat(80));

  const guildId = process.env.GUILD_ID || '297309737135898624';

  try {
    // 1. Vérifier thème actif
    console.log('\n1️⃣ Vérification thème actif:\n');
    const theme = await db.getActiveTheme(guildId);
    console.table(theme);

    if (!theme) {
      console.log('❌ Aucun thème actif');
      process.exit(1);
    }

    // 2. Vérifier données player_progress
    console.log('\n2️⃣ Données player_progress:\n');
    const progress = await db.queryAll(`
      SELECT * FROM player_progress
      WHERE guild_id = $1 AND theme_id = $2
      ORDER BY collected_count DESC
    `, [guildId, theme.id]);
    console.table(progress);

    // 3. Vérifier données players
    console.log('\n3️⃣ Données players:\n');
    const players = await db.queryAll(`
      SELECT * FROM players WHERE guild_id = $1
    `, [guildId]);
    console.table(players);

    // 4. Tester requête leaderboard (recréer la requête)
    console.log('\n4️⃣ Test requête leaderboard:\n');
    const leaderboard = await db.queryAll(`
      SELECT
        p.discord_id,
        p.username,
        pp.collected_count,
        pp.is_completed,
        pp.completed_at
      FROM player_progress pp
      JOIN players p ON pp.player_id = p.id
      WHERE pp.guild_id = $1 AND pp.theme_id = $2
      ORDER BY pp.collected_count DESC, pp.completed_at ASC
      LIMIT 10
    `, [guildId, theme.id]);
    console.table(leaderboard);

    // 5. Tester getLeaderboard() directement
    console.log('\n5️⃣ Test getLeaderboard() fonction:\n');
    const leaderboardFunc = await db.getLeaderboard(theme.id, 10);
    console.log(`Résultat: ${leaderboardFunc ? leaderboardFunc.length : 0} joueur(s)`);
    if (leaderboardFunc) {
      console.table(leaderboardFunc);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test terminé');
    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

testLeaderboard();
