require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function readEmbedDetails() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    const threadId = '1440405288850296909';
    const guildId = '1248028543389143070';

    const guild = await client.guilds.fetch(guildId);
    const thread = await guild.channels.fetch(threadId);
    const messages = await thread.messages.fetch({ limit: 10 });

    // Trouver le message avec l'embed de mission
    for (const [id, msg] of messages) {
      if (msg.embeds.length > 0 && msg.embeds[0].title?.includes('MISSION')) {
        const embed = msg.embeds[0];

        console.log('=== EMBED DE MISSION ===');
        console.log('Titre:', embed.title);
        console.log('\nDescription complète:');
        console.log(embed.description);

        console.log('\nFields:');
        embed.fields?.forEach(field => {
          console.log(`\n${field.name}:`);
          console.log(field.value);
        });

        console.log('\nComponents (boutons):');
        msg.components?.forEach((row, rowIndex) => {
          console.log(`\nRow ${rowIndex + 1}:`);
          row.components?.forEach(comp => {
            console.log(`  - ${comp.label || 'N/A'} (${comp.customId || 'N/A'})`);
          });
        });

        break;
      }
    }

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

readEmbedDetails();
