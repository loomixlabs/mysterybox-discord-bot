const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const MESSAGE_ID = '1441204369222799412';
const GUILD_ID = '1248028543389143070';

async function readMessage() {
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('Bot connecte\n');

    const guild = await client.guilds.fetch(GUILD_ID);
    console.log('Guild:', guild.name);

    // Chercher le message dans tous les canaux texte
    const channels = guild.channels.cache.filter(c => c.type === 0); // Text channels

    for (const [channelId, channel] of channels) {
      try {
        const message = await channel.messages.fetch(MESSAGE_ID);
        if (message) {
          console.log('\n========================================');
          console.log('CANAL TROUVE:', channel.name);
          console.log('CANAL ID:', channelId);
          console.log('========================================\n');

          console.log('CONTENU DU MESSAGE:');
          console.log(message.content || '(pas de contenu texte)');

          if (message.embeds.length > 0) {
            console.log('\n--- EMBEDS ---');
            message.embeds.forEach((embed, i) => {
              console.log(`\nEmbed ${i + 1}:`);
              console.log('Titre:', embed.title);
              console.log('Description:', embed.description);
              console.log('Couleur:', embed.color);
              console.log('Footer:', embed.footer?.text);
              console.log('Image:', embed.image?.url);
              console.log('Thumbnail:', embed.thumbnail?.url);
              if (embed.fields?.length > 0) {
                console.log('Fields:');
                embed.fields.forEach(f => {
                  console.log(`  - ${f.name}: ${f.value}`);
                });
              }
            });
          }

          process.exit(0);
        }
      } catch (e) {
        // Message pas dans ce canal, continuer
      }
    }

    console.log('Message non trouve dans les canaux accessibles');
    process.exit(1);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

readMessage();
