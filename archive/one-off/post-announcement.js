const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const ANNOUNCEMENT_CHANNEL = '1248176835490091110';

const ANNOUNCEMENT_MESSAGE = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌲 L'arbre attend...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Le bon arbre a été trouvé par certains d'entre vous.
Mais le regarder ne révèle rien.

*Les mots ne sont pas toujours la réponse.*
*Parfois, un simple geste suffit.*

Blanche-Neige n'a pas hésité à agir.
Et toi ?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

async function postAnnouncement() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  client.once('ready', async () => {
    try {
      console.log(`🤖 Bot connecté: ${client.user.tag}\n`);

      const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL);
      if (channel) {
        await channel.send({ content: ANNOUNCEMENT_MESSAGE });
        console.log(`✅ Message d'annonce posté dans: ${channel.name}`);
      }

      process.exit(0);
    } catch (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

postAnnouncement();
