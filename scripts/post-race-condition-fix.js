require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const CHANNEL_ID = '1264703299584786484';

const message = `🔧 **Bug corrigé : Clics multiples sur les boîtes mystères**

Version **1.1.1** déployée !

Un bug permettait à plusieurs personnes de cliquer sur la même boîte pendant le délai de traitement.

✅ **Correction appliquée** :
• Vérification immédiate si la boîte a déjà été ouverte
• La première personne à cliquer gagne instantanément
• Les clics suivants reçoivent un message "Trop tard !"

🎯 Les boîtes mystères fonctionnent maintenant parfaitement !`;

async function postRaceConditionFix() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Canal introuvable');
      process.exit(1);
    }

    console.log(`📍 Canal: ${channel.name}`);
    console.log('📤 Envoi du message...\n');

    await channel.send(message);
    console.log('✅ Message de correction posté !');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

postRaceConditionFix();
