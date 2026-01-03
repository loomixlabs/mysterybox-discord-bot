require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const ANNOUNCE_CHANNEL_ID = '1248176835490091110';

const message = `🧹 **GRAND MÉNAGE DE PRINTEMPS** (en novembre, mais c'est le bot qui décide)

Chers chasseurs de mystères !

On appuie sur le gros bouton rouge dans **5 minutes** ⏰

✨ **Ce qui disparaît** :
• Vos collections (on garde les screenshots dans nos cœurs ❤️)
• Vos progressions (comme si de rien n'était)
• L'historique (oubli total, amnésie collective)

🎮 **Ce qui reste** :
• Le bot (évidemment)
• Votre motivation (on espère)
• Les thèmes et collectibles (Blanche-Neige n'a pas bougé)

**Pourquoi ?** Parce que recommencer, c'est mieux qu'un bug qui persiste 🐛

On se retrouve dans 5 minutes pour un nouveau départ !

*PS : Prenez vos screenshots maintenant si vous voulez garder des souvenirs 📸*`;

async function postAnnouncement() {
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
    console.log('✅ Message d\'annonce posté !');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

postAnnouncement();
