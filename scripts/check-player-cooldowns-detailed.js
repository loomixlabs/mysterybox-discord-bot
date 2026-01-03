const db = require('../utils/database-pg');

async function checkPlayerCooldownsDetailed() {
  try {
    const guildId = '1248028543389143070';
    const userId = '297307186307006464'; // xmicordix

    console.log('🔍 VÉRIFICATION DÉTAILLÉE DE player_cooldowns\\n');
    console.log('='.repeat(80));

    // 1. Récupérer le player
    const player = await db.queryOne(
      `SELECT id, username FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    if (!player) {
      console.log('❌ Joueur introuvable\\n');
      process.exit(1);
    }

    console.log(`✅ Player trouvé: ${player.username} (ID: ${player.id})\\n`);

    // 2. Afficher la structure de player_cooldowns
    console.log('📋 STRUCTURE DE player_cooldowns:');
    console.log('-'.repeat(80));
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_cooldowns'
      ORDER BY ordinal_position
    `);

    columns.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
    });

    // 3. Récupérer TOUTES les entrées pour ce joueur (actives ET expirées)
    console.log('\\n\\n📊 TOUTES LES ENTRÉES pour xmicordix (actives ET expirées):');
    console.log('-'.repeat(80));
    const allCooldowns = await db.query(
      `SELECT * FROM player_cooldowns WHERE guild_id = $1 AND player_id = $2 ORDER BY started_at DESC`,
      [guildId, player.id]
    );

    console.log(`   Total: ${allCooldowns.length} entrée(s)\\n`);

    if (allCooldowns.length === 0) {
      console.log('   ❌ Aucune entrée trouvée\\n');
    } else {
      const now = new Date();
      allCooldowns.forEach((cooldown, i) => {
        console.log(`\\n   ${i + 1}. Cooldown:`);
        Object.keys(cooldown).forEach(key => {
          console.log(`      ${key}: ${cooldown[key]}`);
        });

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

    // 4. Vérifier les cooldowns ACTIFS avec hasActiveCooldown
    console.log('\\n\\n🎯 VÉRIFICATION VIA hasActiveCooldown():');
    console.log('-'.repeat(80));
    const hasActive = await db.hasActiveCooldown(guildId, player.id);
    console.log(`   Résultat: ${hasActive ? '🔴 A UN COOLDOWN ACTIF' : '✅ PAS DE COOLDOWN ACTIF'}`);

    // 5. Afficher les conditions exactes utilisées par hasActiveCooldown
    console.log('\\n\\n📋 REQUÊTE hasActiveCooldown (SQL exacte):');
    console.log('-'.repeat(80));
    const activeCooldown = await db.queryOne(`
      SELECT * FROM player_cooldowns
      WHERE guild_id = $1 AND player_id = $2
      AND is_active = TRUE
      AND expires_at > NOW()
      LIMIT 1
    `, [guildId, player.id]);

    if (activeCooldown) {
      console.log('   🔴 COOLDOWN ACTIF TROUVÉ:');
      Object.keys(activeCooldown).forEach(key => {
        console.log(`      ${key}: ${activeCooldown[key]}`);
      });
    } else {
      console.log('   ✅ Aucun cooldown actif trouvé\\n');
    }

    console.log('\\n' + '='.repeat(80));
    console.log('✅ Vérification terminée\\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkPlayerCooldownsDetailed();
