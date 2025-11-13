const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const ANNOUNCEMENT_CHANNEL = '1248176835490091110';

async function postEmptyBoxAnnouncement() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  client.once('ready', async () => {
    try {
      console.log('🤖 Bot connecté, envoi de l\'annonce...');

      const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL);

      if (!channel) {
        console.error('❌ Canal introuvable');
        process.exit(1);
      }

      const embed = new EmbedBuilder()
        .setTitle('📦 NOUVEAU PIÈGE - La Boîte Vide')
        .setColor('#95a5a6')
        .setDescription(
          `Un nouveau piège a fait son apparition dans le royaume !\n\n` +
          `**La Boîte Vide** 📦\n` +
          `*"Sérieusement, qui peut bien avoir l'idée d'envoyer une boîte vide ?"*\n\n` +
          `Ce piège est spécial... il ne fait absolument **rien** ! ` +
          `Ni gain, ni perte, ni mission. Juste... le vide.\n\n` +
          `C'est le piège parfait pour ceux qui aiment perdre leur temps ! 😂\n\n` +
          `*Note: Si vous avez un bouclier anti-piège, il sera quand même consommé. ` +
          `Parce que techniquement, c'est un piège. Un piège inutile, mais un piège quand même.* 🛡️😈`
        )
        .addFields(
          {
            name: '🎯 Effet',
            value: 'Aucun. Vraiment aucun.',
            inline: true
          },
          {
            name: '⚠️ Danger',
            value: 'Niveau: Inexistant',
            inline: true
          },
          {
            name: '😂 Frustration',
            value: 'Niveau: Maximum',
            inline: true
          }
        )
        .setFooter({ text: 'Un cadeau de la maison ! 🎁' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      console.log('✅ Annonce envoyée avec succès !');
      process.exit(0);
    } catch (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

postEmptyBoxAnnouncement();
