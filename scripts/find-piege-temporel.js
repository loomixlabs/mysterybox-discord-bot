const db = require('../utils/database-pg');

async function findPiegeTemporel() {
  try {
    const guildId = '1248028543389143070';
    const userId = '297307186307006464'; // xmicordix

    console.log('⏰ RECHERCHE "PIÈGE TEMPOREL"\n');
    console.log('='.repeat(80));

    // 1. Chercher le piège par nom dans TOUS les thèmes
    console.log('📋 RECHERCHE DU PIÈGE:');
    console.log('-'.repeat(80));
    const piegeTemporel = await db.query(`
      SELECT t.*, th.name as theme_name, th.is_active
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE th.guild_id = $1
      AND (
        t.name ILIKE '%temporel%'
        OR t.name ILIKE '%temps%'
        OR t.name ILIKE '%time%'
        OR t.description ILIKE '%temporel%'
        OR t.cooldown_duration > 0
      )
      ORDER BY t.id
    `, [guildId]);

    console.log(`   Résultats: ${piegeTemporel.length} piège(s)\n`);

    if (piegeTemporel.length === 0) {
      console.log('❌ Aucun piège trouvé avec "temporel" ou cooldown\n');

      // Lister TOUS les pièges du serveur
      console.log('📋 TOUS LES PIÈGES DU SERVEUR:');
      console.log('-'.repeat(80));
      const allTraps = await db.query(`
        SELECT t.id, t.name, t.cooldown_duration, th.name as theme_name
        FROM traps t
        JOIN themes th ON t.theme_id = th.id
        WHERE th.guild_id = $1
        ORDER BY t.id
      `, [guildId]);

      allTraps.forEach((trap, i) => {
        console.log(`   ${i + 1}. ${trap.name} (ID: ${trap.id}) - ${trap.theme_name} - Cooldown: ${trap.cooldown_duration}min`);
      });

      process.exit(0);
    }

    // Afficher les détails de chaque piège trouvé
    piegeTemporel.forEach((trap, i) => {
      console.log(`\n   ${i + 1}. ${trap.name} (ID: ${trap.id})`);
      console.log(`      Thème: ${trap.theme_name} (Actif: ${trap.is_active ? '✅' : '❌'})`);
      console.log(`      Type: ${trap.type}`);
      console.log(`      Cooldown: ${trap.cooldown_duration} minutes`);
      console.log(`      Description: ${trap.description}`);
    });

    // 2. Récupérer le player
    console.log('\n\n📊 HISTORIQUE DES DÉCLENCHEMENTS:');
    console.log('-'.repeat(80));
    const player = await db.queryOne(
      `SELECT id FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    // Pour chaque piège trouvé, vérifier s'il a été déclenché
    for (const trap of piegeTemporel) {
      const triggered = await db.query(`
        SELECT *
        FROM trap_triggered
        WHERE guild_id = $1
        AND player_id = $2
        AND trap_id = $3
        ORDER BY triggered_at DESC
      `, [guildId, player.id, trap.id]);

      console.log(`\n   ${trap.name} (ID: ${trap.id}):`);
      console.log(`      Déclenché ${triggered.length} fois`);

      if (triggered.length > 0) {
        const now = new Date();
        triggered.forEach((t, i) => {
          const triggeredAt = new Date(t.triggered_at);
          const cooldownEndsAt = new Date(triggeredAt.getTime() + trap.cooldown_duration * 60 * 1000);
          const isActive = cooldownEndsAt > now;
          const timeLeft = cooldownEndsAt - now;
          const minutesLeft = Math.floor(timeLeft / (1000 * 60));

          console.log(`\n      ${i + 1}. Déclenché: ${triggeredAt.toLocaleString('fr-FR')}`);
          console.log(`         Fin cooldown: ${cooldownEndsAt.toLocaleString('fr-FR')}`);
          console.log(`         Statut: ${isActive ? '🔴 ACTIF' : '✅ EXPIRÉ'}`);
          if (isActive) {
            console.log(`         ⏱️  Temps restant: ${minutesLeft} minutes`);
          }
        });

        // Si cooldown actif, le supprimer
        const activeCount = triggered.filter(t => {
          const triggeredAt = new Date(t.triggered_at);
          const cooldownEndsAt = new Date(triggeredAt.getTime() + trap.cooldown_duration * 60 * 1000);
          return cooldownEndsAt > now;
        }).length;

        if (activeCount > 0) {
          console.log('\n' + '='.repeat(80));
          console.log(`\n⚠️  ${activeCount} COOLDOWN(S) ACTIF(S)!`);
          console.log('\n💡 Suppression en cours...\n');

          await db.query(`
            DELETE FROM trap_triggered
            WHERE guild_id = $1
            AND player_id = $2
            AND trap_id = $3
          `, [guildId, player.id, trap.id]);

          console.log(`✅ ${triggered.length} entrée(s) supprimée(s)`);
          console.log('✅ Cooldown levé!\n');
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Recherche terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

findPiegeTemporel();
