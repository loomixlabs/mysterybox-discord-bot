const db = require('../utils/database-pg');

async function checkCorrectServerCooldown() {
  try {
    const guildId = '297309737135898624'; // BON serveur de test
    const userId = '297307186307006464'; // xmicordix

    console.log('🔍 VÉRIFICATION SUR LE BON SERVEUR DE TEST\\n');
    console.log(`   Guild ID: ${guildId}\\n`);
    console.log('='.repeat(80));

    // 1. Récupérer le player
    const player = await db.queryOne(
      `SELECT id, username FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    if (!player) {
      console.log('❌ Joueur introuvable sur ce serveur\\n');
      process.exit(1);
    }

    console.log(`✅ Player trouvé: ${player.username} (ID: ${player.id})\\n`);

    // 2. Vérifier player_cooldowns
    console.log('📋 TABLE player_cooldowns:');
    console.log('-'.repeat(80));
    const cooldowns = await db.query(
      `SELECT * FROM player_cooldowns WHERE guild_id = $1 AND player_id = $2 ORDER BY started_at DESC`,
      [guildId, player.id]
    );

    console.log(`   Total: ${cooldowns.length} entrée(s)\\n`);

    if (cooldowns.length > 0) {
      const now = new Date();
      cooldowns.forEach((cooldown, i) => {
        console.log(`\\n   ${i + 1}. Cooldown ID ${cooldown.id}:`);
        console.log(`      trap_id: ${cooldown.trap_id}`);
        console.log(`      started_at: ${new Date(cooldown.started_at).toLocaleString('fr-FR')}`);
        console.log(`      expires_at: ${new Date(cooldown.expires_at).toLocaleString('fr-FR')}`);
        console.log(`      is_active: ${cooldown.is_active}`);

        const expiresAt = new Date(cooldown.expires_at);
        const isActive = cooldown.is_active && expiresAt > now;
        const timeLeft = Math.max(0, expiresAt - now);
        const minutesLeft = Math.floor(timeLeft / (1000 * 60));

        console.log(`      >>> Calculé: ${isActive ? '🔴 ACTIF' : '✅ EXPIRÉ'}`);
        if (isActive) {
          console.log(`      >>> Temps restant: ${minutesLeft} minutes`);
        }
      });
    }

    // 3. Vérifier via hasActiveCooldown
    console.log('\\n\\n🎯 VÉRIFICATION VIA hasActiveCooldown():');
    console.log('-'.repeat(80));
    const hasActive = await db.hasActiveCooldown(guildId, player.id);
    console.log(`   Résultat: ${hasActive ? '🔴 A UN COOLDOWN ACTIF' : '✅ PAS DE COOLDOWN ACTIF'}\\n`);

    // 4. Vérifier trap_triggered
    console.log('\\n📋 TABLE trap_triggered:');
    console.log('-'.repeat(80));
    const triggers = await db.query(
      `SELECT tt.*, t.name, t.type, t.cooldown_duration
       FROM trap_triggered tt
       JOIN traps t ON tt.trap_id = t.id
       WHERE tt.guild_id = $1 AND tt.player_id = $2
       ORDER BY tt.triggered_at DESC
       LIMIT 5`,
      [guildId, player.id]
    );

    console.log(`   Total (5 derniers): ${triggers.length} piège(s) déclenché(s)\\n`);

    const now = new Date();
    triggers.forEach((trap, i) => {
      console.log(`\\n   ${i + 1}. ${trap.name} (Trap ID: ${trap.trap_id})`);
      console.log(`      Type: ${trap.type}`);
      console.log(`      Déclenché: ${new Date(trap.triggered_at).toLocaleString('fr-FR')}`);
      console.log(`      Cooldown: ${trap.cooldown_duration} minutes`);

      if (trap.cooldown_duration > 0) {
        const triggeredAt = new Date(trap.triggered_at);
        const cooldownEndsAt = new Date(triggeredAt.getTime() + trap.cooldown_duration * 60 * 1000);
        const isActive = cooldownEndsAt > now;
        const timeLeft = Math.max(0, cooldownEndsAt - now);
        const minutesLeft = Math.floor(timeLeft / (1000 * 60));

        console.log(`      Expire: ${cooldownEndsAt.toLocaleString('fr-FR')}`);
        console.log(`      Statut: ${isActive ? '🔴 ACTIF' : '✅ EXPIRÉ'}`);
        if (isActive) {
          console.log(`      ⏱️  Temps restant: ${minutesLeft} minutes`);
        }
      }
    });

    // 5. Lister tous les pièges de type cooldown sur ce serveur
    console.log('\\n\\n📋 PIÈGES DE TYPE "cooldown" SUR CE SERVEUR:');
    console.log('-'.repeat(80));
    const cooldownTraps = await db.query(`
      SELECT t.*, th.name as theme_name, th.is_active
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE th.guild_id = $1 AND t.type = 'cooldown'
      ORDER BY th.is_active DESC, t.name
    `, [guildId]);

    console.log(`   Total: ${cooldownTraps.length} piège(s)\\n`);

    cooldownTraps.forEach((trap, i) => {
      console.log(`   ${i + 1}. ${trap.name} (ID: ${trap.id})`);
      console.log(`      Thème: ${trap.theme_name} ${trap.is_active ? '(✅ ACTIF)' : '(❌ Inactif)'}`);
      console.log(`      Cooldown: ${trap.cooldown_duration} minutes\\n`);
    });

    // 6. SI cooldown actif trouvé, proposer de le supprimer
    if (hasActive) {
      console.log('\\n' + '='.repeat(80));
      console.log('🚨 COOLDOWN ACTIF DÉTECTÉ!\\n');
      console.log('💡 Pour supprimer ce cooldown, supprimons l\'entrée...\\n');

      await db.query(
        `DELETE FROM player_cooldowns WHERE guild_id = $1 AND player_id = $2 AND is_active = TRUE`,
        [guildId, player.id]
      );

      console.log('✅ Cooldown(s) actif(s) supprimé(s)!\\n');
    }

    console.log('\\n' + '='.repeat(80));
    console.log('✅ Vérification terminée\\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkCorrectServerCooldown();
