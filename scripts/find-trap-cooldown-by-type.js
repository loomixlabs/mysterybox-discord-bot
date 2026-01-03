const db = require('../utils/database-pg');

async function findTrapCooldownByType() {
  try {
    const guildId = '1248028543389143070';
    const userId = '297307186307006464'; // xmicordix

    console.log('🔍 RECHERCHE DES PIÈGES PAR TYPE "cooldown"\\n');
    console.log('='.repeat(80));

    // 1. Récupérer TOUS les pièges de type "cooldown"
    console.log('📋 TOUS LES PIÈGES DE TYPE "cooldown":');
    console.log('-'.repeat(80));
    const cooldownTraps = await db.query(`
      SELECT t.*, th.name as theme_name, th.is_active
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE th.guild_id = $1 AND t.type = 'cooldown'
      ORDER BY th.is_active DESC, t.id
    `, [guildId]);

    console.log(`   Total: ${cooldownTraps.length} piège(s) de type cooldown\\n`);

    cooldownTraps.forEach((trap, i) => {
      console.log(`\\n   ${i + 1}. ${trap.name} (ID: ${trap.id})`);
      console.log(`      Thème: ${trap.theme_name} ${trap.is_active ? '(✅ ACTIF)' : '(❌ Inactif)'}`);
      console.log(`      Type: ${trap.type}`);
      console.log(`      Cooldown: ${trap.cooldown_duration} minutes`);
      console.log(`      Effect type: ${trap.effect_type}`);
      console.log(`      Effect value: ${trap.effect_value}`);
      console.log(`      Effect unit: ${trap.effect_unit}`);
    });

    // 2. Récupérer le player
    const player = await db.queryOne(
      `SELECT id FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    // 3. Vérifier si ce joueur a déclenché un de ces pièges
    console.log('\\n\\n📊 HISTORIQUE DES DÉCLENCHEMENTS POUR xmicordix:');
    console.log('-'.repeat(80));

    for (const trap of cooldownTraps) {
      const triggers = await db.query(`
        SELECT * FROM trap_triggered
        WHERE guild_id = $1 AND player_id = $2 AND trap_id = $3
        ORDER BY triggered_at DESC
      `, [guildId, player.id, trap.id]);

      if (triggers.length > 0) {
        console.log(`\\n   🎯 Piège "${trap.name}" (ID: ${trap.id}) - ${triggers.length} fois`);
        triggers.forEach((t, i) => {
          const triggeredAt = new Date(t.triggered_at);
          const cooldownEndsAt = new Date(triggeredAt.getTime() + trap.cooldown_duration * 60 * 1000);
          const now = new Date();
          const isActive = cooldownEndsAt > now;
          const timeLeft = Math.max(0, cooldownEndsAt - now);
          const minutesLeft = Math.floor(timeLeft / (1000 * 60));

          console.log(`      ${i + 1}. Déclenché: ${triggeredAt.toLocaleString('fr-FR')}`);
          console.log(`         Expire: ${cooldownEndsAt.toLocaleString('fr-FR')}`);
          console.log(`         Statut: ${isActive ? '🔴 ACTIF' : '✅ EXPIRÉ'}`);
          if (isActive) {
            console.log(`         ⏱️  Temps restant: ${minutesLeft} minutes`);
          }
        });
      }
    }

    console.log('\\n' + '='.repeat(80));
    console.log('✅ Recherche terminée\\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

findTrapCooldownByType();
