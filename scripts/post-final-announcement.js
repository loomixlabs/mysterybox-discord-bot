require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const ANNOUNCE_CHANNEL_ID = '1248176835490091110';

const message = `✅ **RÉINITIALISATION TERMINÉE !**

Le bot est de nouveau opérationnel ! 🎮

📊 **Résultats du grand ménage** :
• 21 joueurs réinitialisés
• 72 collections effacées
• 224 gives oubliés
• Tout le monde repart à zéro ! 🔄

🎯 **Que la chasse commence !**

Tapez \`/profile\` pour vous inscrire et commencer votre aventure ! 🚀

Bonne chance à tous ! 🍀`;

async function postFinalAnnouncement() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté');

    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Canal introuvable');
      process.exit(1);
    }

    await channel.send(message);
    console.log('✅ Message final posté !');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

postFinalAnnouncement();
