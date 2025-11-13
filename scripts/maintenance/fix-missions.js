const db = require('./utils/database-pg');

async function fixMissions() {
  try {
    const guildId = '297309737135898624';

    console.log('🔧 Correction des missions...\n');

    // Mission #1: Mot Deviné (keyword-message)
    await db.query(
      `UPDATE missions
       SET name = $1,
           description = $2,
           timeout = $3
       WHERE guild_id = $4 AND id = $5`,
      [
        'Mot Deviné',
        'Fais dire le mot secret à un autre joueur dans le salon indiqué ! ⚠️ Si TU le dis, tu échoues la mission !',
        300,
        guildId,
        1
      ]
    );
    console.log('✅ Mission #1 "Mot Deviné" mise à jour');

    // Mission #2: Quiz (quiz)
    await db.query(
      `UPDATE missions
       SET name = $1,
           description = $2,
           timeout = $3
       WHERE guild_id = $4 AND id = $5`,
      [
        'Quiz',
        'Réponds correctement à une question de culture générale sur le thème !',
        60,
        guildId,
        2
      ]
    );
    console.log('✅ Mission #2 "Quiz" mise à jour\n');

    // Afficher les résultats
    const missions = await db.queryAll(
      'SELECT id, name, description, timeout FROM missions WHERE guild_id = $1 ORDER BY id',
      [guildId]
    );

    console.log('📋 Missions après correction:\n');
    missions.forEach(m => {
      console.log(`  ${m.id}. ${m.name}`);
      console.log(`     Description: ${m.description}`);
      console.log(`     Timeout: ${m.timeout}s\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixMissions();
