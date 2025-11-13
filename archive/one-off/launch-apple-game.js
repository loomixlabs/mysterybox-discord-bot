const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();

const CHANNEL_ID = '1433850027364847646'; // Canal privé de test
const GUILD_ID = '1248028543389143070';
const TREE_IMAGE_URL = 'https://popcinema.fr/wp-content/uploads/2025/05/Disney-vs-Pixar-Quel-studio-a-vraiment-le-meilleur-film-.png';

async function launchAppleGame() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
  });

  client.once('ready', async () => {
    try {
      console.log(`🤖 Bot connecté: ${client.user.tag}\n`);

      // Récupérer le canal
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) {
        console.error('❌ Canal introuvable !');
        process.exit(1);
      }

      console.log(`✅ Canal trouvé: ${channel.name}\n`);

      // Poster l'image de l'arbre
      console.log('🌲 Envoi de l\'image de l\'arbre...');

      const message = await channel.send({
        content: TREE_IMAGE_URL
      });

      console.log(`✅ Message posté ! ID: ${message.id}\n`);

      // Afficher les instructions
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🍎 MINI-JEU DE LA POMME LANCÉ !');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📌 Canal: ${channel.name}`);
      console.log(`🆔 Message ID: ${message.id}`);
      console.log(`🔗 Lien: https://discord.com/channels/${GUILD_ID}/${CHANNEL_ID}/${message.id}`);
      console.log('');
      console.log('📝 INSTRUCTIONS:');
      console.log('1. Copie le Message ID ci-dessus');
      console.log('2. Ouvre index.js');
      console.log('3. Après le chargement des événements, ajoute:');
      console.log('');
      console.log('   const reactionHandler = require(\'./events/messageReactionAdd\');');
      console.log(`   reactionHandler.setAppleGameMessageId('${message.id}');`);
      console.log('');
      console.log('4. Redémarre le bot');
      console.log('5. Les joueurs qui réagissent avec 🍎 recevront le MP !');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      process.exit(0);

    } catch (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

launchAppleGame();
