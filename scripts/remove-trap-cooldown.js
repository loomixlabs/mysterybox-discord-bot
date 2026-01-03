const db = require('../utils/database-pg');

async function removeTrapCooldown() {
  try {
    const GUILD_ID = '297309737135898624'; // Serveur de TEST
    const USER_ID = '297307186307006464'; // xmicordix

    console.log('🔧 SUPPRESSION DU COOLDOWN DE PIÈGE\n');
    console.log('='.repeat(80));
    console.log(`\n🎯 Guild ID: ${GUILD_ID}`);
    console.log(`👤 User ID: ${USER_ID}\n`);

    // 1. Vérifier la structure de la table player_cooldowns
    console.log('📋 ÉTAPE 1: Structure de la table player_cooldowns\n');

    const columns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_cooldowns'
      ORDER BY ordinal_position
    `);

    console.table(columns);

    // 2. Récupérer le player_id
    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 ÉTAPE 2: Recherche du joueur\n');

    const player = await db.queryOne(
      `SELECT id, username FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [GUILD_ID, USER_ID]
    );

    if (!player) {
      console.log('❌ Joueur introuvable dans la base de données\n');
      process.exit(1);
    }

    console.log(`✅ Joueur trouvé:`);
    console.log(`   Player ID: ${player.id}`);
    console.log(`   Username: ${player.username}\n`);

    // 3. Vérifier les cooldowns actuels
    console.log('='.repeat(80));
    console.log('\n📊 ÉTAPE 3: Cooldowns actuels\n');

    const currentCooldowns = await db.query(
      `SELECT * FROM player_cooldowns WHERE guild_id = $1 AND player_id = $2`,
      [GUILD_ID, player.id]
    );

    console.log(`Nombre de cooldowns: ${currentCooldowns.length}\n`);

    if (currentCooldowns.length === 0) {
      console.log('✅ Aucun cooldown trouvé - Rien à supprimer\n');
      console.log('='.repeat(80));
      process.exit(0);
    }

    currentCooldowns.forEach((cooldown, index) => {
      const expiresAt = new Date(cooldown.expires_at);
      const now = new Date();
      const timeLeft = expiresAt - now;
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const isExpired = timeLeft <= 0;

      console.log(`${index + 1}. Cooldown ID: ${cooldown.id}`);
      console.log(`   Type: ${cooldown.cooldown_type}`);
      console.log(`   Expire: ${expiresAt.toLocaleString('fr-FR')}`);
      console.log(`   Temps restant: ${isExpired ? '⚠️  EXPIRÉ' : `${hoursLeft}h ${minutesLeft}min`}\n`);
    });

    // 4. Supprimer tous les cooldowns
    console.log('='.repeat(80));
    console.log('\n🗑️  ÉTAPE 4: Suppression des cooldowns\n');

    const result = await db.query(
      `DELETE FROM player_cooldowns WHERE guild_id = $1 AND player_id = $2 RETURNING *`,
      [GUILD_ID, player.id]
    );

    console.log(`✅ ${result.length} cooldown(s) supprimé(s) avec succès!\n`);

    result.forEach((deleted, index) => {
      console.log(`   ${index + 1}. ${deleted.cooldown_type} (ID: ${deleted.id})`);
    });

    // 5. Vérification finale
    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 ÉTAPE 5: Vérification finale\n');

    const remainingCooldowns = await db.query(
      `SELECT * FROM player_cooldowns WHERE guild_id = $1 AND player_id = $2`,
      [GUILD_ID, player.id]
    );

    if (remainingCooldowns.length === 0) {
      console.log('✅ Plus aucun cooldown pour ce joueur!\n');
      console.log('💡 Tu peux maintenant ouvrir des mystery boxes à nouveau.\n');
    } else {
      console.log(`⚠️  Il reste encore ${remainingCooldowns.length} cooldown(s)\n`);
    }

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

removeTrapCooldown();
