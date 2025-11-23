require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const GUILD_ID = '1439293457754488905';

async function convertToPremium() {
  console.log('🔄 Conversion en premium...\n');

  // 1. Récupérer les infos du serveur
  const configResult = await pool.query(
    'SELECT guild_id, guild_name, owner_id, is_trial, trial_expires_at FROM guild_config WHERE guild_id = $1',
    [GUILD_ID]
  );

  if (configResult.rows.length === 0) {
    console.log('❌ Serveur non trouvé');
    await pool.end();
    process.exit(1);
  }

  const config = configResult.rows[0];
  console.log('📋 Serveur trouvé:', config.guild_name);
  console.log('   Owner ID:', config.owner_id);
  console.log('   Was trial:', config.is_trial);
  console.log('   Trial expires:', config.trial_expires_at);

  // 2. Convertir en premium dans la DB
  const updateResult = await pool.query(`
    UPDATE guild_config
    SET is_trial = FALSE,
        trial_expires_at = NULL,
        max_players = NULL,
        notes = $2
    WHERE guild_id = $1
    RETURNING *
  `, [GUILD_ID, 'Converti en premium le ' + new Date().toLocaleDateString('fr-FR')]);

  console.log('\n✅ Converti en premium dans la DB');
  console.log('   is_trial:', updateResult.rows[0].is_trial);
  console.log('   trial_expires_at:', updateResult.rows[0].trial_expires_at);

  await pool.end();

  // 3. Connecter le client Discord pour envoyer le DM
  console.log('\n🤖 Connexion à Discord pour envoyer le DM...');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once('ready', async () => {
    console.log('✅ Client connecté:', client.user.tag);

    try {
      const owner = await client.users.fetch(config.owner_id);
      await owner.send({
        content: `🎉 **Félicitations ! Votre serveur est maintenant Premium !**\n\n` +
          `Le serveur **${config.guild_name}** a été converti en version **Premium** 💎\n\n` +
          `**Avantages débloqués:**\n` +
          `• ✅ Accès illimité au bot\n` +
          `• ✅ Plus de limite de temps\n` +
          `• ✅ Support prioritaire\n` +
          `• ✅ Nouvelles fonctionnalités en avant-première\n\n` +
          `Merci pour votre confiance ! 🚀`
      });
      console.log(`\n✅ DM Premium envoyé à ${owner.tag} !`);
    } catch (dmError) {
      console.log(`\n⚠️ Impossible d'envoyer le DM: ${dmError.message}`);
    }

    console.log('\n🎉 Conversion terminée !');
    client.destroy();
    process.exit(0);
  });

  client.login(process.env.DISCORD_TOKEN);
}

convertToPremium().catch(error => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});
