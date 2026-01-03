require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const CHANNEL_ID = '1428022920743092284';

const message = `🔧 **Bug corrigé : Boutons disparus sur les boîtes mystères**

Un bug a été identifié et corrigé : lorsqu'un joueur avec un cooldown actif cliquait sur une boîte, le bouton disparaissait pour tout le monde.

✅ **Correction appliquée** : Le bouton reste maintenant visible pour tous les joueurs, même si quelqu'un en cooldown essaie de cliquer.

🎯 Les boîtes mystères fonctionnent maintenant normalement !`;

async function postBugFixMessage() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté');

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Canal introuvable');
      process.exit(1);
    }

    await channel.send(message);
    console.log('✅ Message de correction de bug posté !');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

postBugFixMessage();
