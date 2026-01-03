const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
require('dotenv').config();

const MESSAGE_ID = '1441204369222799412';

// Essayer plusieurs salons possibles
const POSSIBLE_CHANNELS = [
  '1248028543389143073', // general
  '1248028543389143074',
  '1248028543389143075',
  '1248028543389143076',
  '1300057274433277982', // ancien ID
];

async function readMessage() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  // D'abord, lister les canaux du serveur
  const GUILD_ID = '1248028543389143070';

  try {
    console.log('Recuperation des canaux du serveur...\n');
    const channels = await rest.get(Routes.guildChannels(GUILD_ID));

    const textChannels = channels.filter(c => c.type === 0);
    console.log('Canaux texte:');
    textChannels.forEach(c => {
      console.log(`  - ${c.name}: ${c.id}`);
    });

    console.log('\n\nRecherche du message dans chaque canal...\n');

    for (const channel of textChannels) {
      try {
        const message = await rest.get(
          Routes.channelMessage(channel.id, MESSAGE_ID)
        );

        console.log('========================================');
        console.log('MESSAGE TROUVE !');
        console.log('Canal:', channel.name);
        console.log('Canal ID:', channel.id);
        console.log('========================================\n');

        console.log('Contenu:', message.content || '(vide)');

        if (message.embeds && message.embeds.length > 0) {
          console.log('\n--- EMBEDS ---');
          message.embeds.forEach((embed, i) => {
            console.log(`\nEmbed ${i + 1}:`);
            console.log('Title:', embed.title);
            console.log('Description:', embed.description);
            console.log('Color:', embed.color);
            if (embed.footer) console.log('Footer:', embed.footer.text);
            if (embed.image) console.log('Image:', embed.image.url);
            if (embed.thumbnail) console.log('Thumbnail:', embed.thumbnail.url);
            if (embed.fields && embed.fields.length > 0) {
              console.log('Fields:');
              embed.fields.forEach(f => {
                console.log(`  [${f.name}]`);
                console.log(`  ${f.value}`);
                console.log('');
              });
            }
          });
        }

        process.exit(0);
      } catch (e) {
        // Message not in this channel, continue
      }
    }

    console.log('Message non trouve dans aucun canal');
    process.exit(1);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

readMessage();
