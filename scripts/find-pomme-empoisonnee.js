const db = require('../utils/database-pg');

async function findPommeEmpoisonnee() {
  try {
    const guildId = '1248028543389143070';
    const userId = '297307186307006464'; // xmicordix

    console.log('🍎 RECHERCHE "LA POMME EMPOISONNÉE"\n');
    console.log('='.repeat(80));

    // Récupérer le player
    const player = await db.queryOne(
      `SELECT id FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    // Chercher TOUTES les occurrences du piège ID 10
    const pommeEmpoisonnee = await db.query(`
      SELECT tt.*, t.name, t.cooldown_duration
      FROM trap_triggered tt
      JOIN traps t ON tt.trap_id = t.id
      WHERE tt.guild_id = $1
      AND tt.player_id = $2
      AND tt.trap_id = 10
      ORDER BY tt.triggered_at DESC
    `, [guildId, player.id]);

    console.log(`📊 Nombre de fois que "La Pomme Empoisonnée" a été déclenchée: ${pommeEmpoisonnee.length}\n`);

    if (pommeEmpoisonnee.length === 0) {
      console.log('❌ Aucune occurrence trouvée\n');
      console.log('💡 Si le bot dit que tu as un cooldown, c\'est peut-être un bug\n');
    } else {
      const now = new Date();
      pommeEmpoisonnee.forEach((trap, i) => {
        const triggeredAt = new Date(trap.triggered_at);
        const cooldownEndsAt = new Date(triggeredAt.getTime() + trap.cooldown_duration * 60 * 1000);
        const isActive = cooldownEndsAt > now;
        const timeLeft = cooldownEndsAt - now;
        const minutesLeft = Math.floor(timeLeft / (1000 * 60));

        console.log(`\n${i + 1}. Déclenché: ${triggeredAt.toLocaleString('fr-FR')}`);
        console.log(`   Fin du cooldown: ${cooldownEndsAt.toLocaleString('fr-FR')}`);
        console.log(`   Statut: ${isActive ? '🔴 ACTIF' : '✅ EXPIRÉ'}`);
        if (isActive) {
          console.log(`   ⏱️  Temps restant: ${minutesLeft} minutes`);
        }
      });

      // Si le cooldown est actif, proposer de le supprimer
      const activeCount = pommeEmpoisonnee.filter(t => {
        const triggeredAt = new Date(t.triggered_at);
        const cooldownEndsAt = new Date(triggeredAt.getTime() + t.cooldown_duration * 60 * 1000);
        return cooldownEndsAt > now;
      }).length;

      if (activeCount > 0) {
        console.log('\n' + '='.repeat(80));
        console.log(`\n⚠️  ${activeCount} cooldown(s) ACTIF(S) détecté(s)!`);
        console.log('\n💡 Pour supprimer ce cooldown, je vais supprimer l\'entrée dans trap_triggered...\n');

        // Supprimer TOUTES les entrées de La Pomme Empoisonnée
        await db.query(`
          DELETE FROM trap_triggered
          WHERE guild_id = $1
          AND player_id = $2
          AND trap_id = 10
        `, [guildId, player.id]);

        console.log(`✅ ${pommeEmpoisonnee.length} entrée(s) supprimée(s) de trap_triggered`);
        console.log('✅ Le cooldown est maintenant levé!\n');
      }
    }

    console.log('='.repeat(80));
    console.log('✅ Recherche terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

findPommeEmpoisonnee();
