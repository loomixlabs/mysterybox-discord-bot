const db = require('../utils/database-pg');

async function findCooldownTrap() {
  try {
    const guildId = '1248028543389143070';
    const userId = '297307186307006464'; // xmicordix

    console.log('🔍 RECHERCHE DU PIÈGE AVEC COOLDOWN\n');
    console.log('='.repeat(80));

    // 1. Récupérer TOUS les pièges du thème actif
    console.log('📋 TOUS LES PIÈGES DU THÈME ACTIF:');
    console.log('-'.repeat(80));
    const allTraps = await db.query(`
      SELECT t.*
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE th.guild_id = $1 AND th.is_active = TRUE
      ORDER BY t.id
    `, [guildId]);

    console.log(`   Total: ${allTraps.length} piège(s)\n`);

    allTraps.forEach((trap, i) => {
      console.log(`\n   ${i + 1}. ${trap.name} (ID: ${trap.id})`);
      console.log(`      type: ${trap.type}`);
      console.log(`      cooldown_duration: ${trap.cooldown_duration} minutes`);
      if (trap.cooldown_duration > 0) {
        console.log(`      ⚠️  CE PIÈGE A UN COOLDOWN!`);
      }
    });

    // 2. Récupérer le player
    const player = await db.queryOne(
      `SELECT id FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    // 3. Vérifier s'il y a une entrée dans trap_triggered récente avec cooldown
    console.log('\n\n📊 PIÈGES RÉCENTS DÉCLENCHÉS PAR xmicordix:');
    console.log('-'.repeat(80));
    const recentTraps = await db.query(`
      SELECT tt.*, t.name, t.cooldown_duration, t.type
      FROM trap_triggered tt
      JOIN traps t ON tt.trap_id = t.id
      WHERE tt.guild_id = $1 AND tt.player_id = $2
      ORDER BY tt.triggered_at DESC
      LIMIT 10
    `, [guildId, player.id]);

    console.log(`   Total: ${recentTraps.length} piège(s)\n`);

    const now = new Date();
    recentTraps.forEach((trap, i) => {
      const triggeredAt = new Date(trap.triggered_at);
      const cooldownEndsAt = new Date(triggeredAt.getTime() + trap.cooldown_duration * 60 * 1000);
      const isActive = cooldownEndsAt > now;

      console.log(`\n   ${i + 1}. ${trap.name} (Trap ID: ${trap.trap_id})`);
      console.log(`      Déclenché: ${triggeredAt.toLocaleString('fr-FR')}`);
      console.log(`      Cooldown: ${trap.cooldown_duration} minutes`);

      if (trap.cooldown_duration > 0) {
        console.log(`      Fin du cooldown: ${cooldownEndsAt.toLocaleString('fr-FR')}`);
        console.log(`      Statut: ${isActive ? '🔴 ACTIF' : '✅ EXPIRÉ'}`);

        if (isActive) {
          const timeLeft = cooldownEndsAt - now;
          const minutesLeft = Math.floor(timeLeft / (1000 * 60));
          console.log(`      ⏱️  Temps restant: ${minutesLeft} minutes`);
        }
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Recherche terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

findCooldownTrap();
