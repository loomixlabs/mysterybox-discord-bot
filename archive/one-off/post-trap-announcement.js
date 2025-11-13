const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const ANNOUNCEMENT_CHANNEL = '1248176835490091110';

async function postAnnouncement() {
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
        .setTitle('🎉 BONNE NOUVELLE - Bug des Pièges Corrigé !')
        .setColor('#00FF00')
        .setDescription(
          `Le bug qui faisait disparaître vos collectibles sans laisser de trace est **ENFIN** résolu !\n\n` +
          `**Maintenant :**\n` +
          `✅ Historique complet des gains ET pertes\n` +
          `✅ Compteur toujours synchronisé\n` +
          `✅ Traçabilité parfaite dans \`/profile\`\n\n` +
          `Une boîte mystère de **test** accompagne cette annonce pour vérifier le bon fonctionnement du système !`
        )
        .addFields({
          name: '📝 Note',
          value: '*Cette boîte contient un piège pour tester le nouveau système d\'historique. Les joueurs attentifs qui lisent jusqu\'au bout sont prévenus. Les autres... eh bien, vous aurez une belle entrée dans votre historique !* 😈',
          inline: false
        })
        .setFooter({ text: 'Bonne chasse ! 🎯' })
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

postAnnouncement();
