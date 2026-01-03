const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

async function postAnnouncement() {
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté');

    const channelId = '1248176835490091110';
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      throw new Error(`Canal ${channelId} introuvable`);
    }

    console.log(`📢 Canal trouvé: ${channel.name}`);

    const embed = new EmbedBuilder()
      .setColor('#00D9FF')
      .setTitle('🎉 Mise à Jour v1.4.0 - Système de Super Bonuses')
      .setDescription('Nous avons ajouté de nouvelles fonctionnalités passionnantes au bot!')
      .addFields(
        {
          name: '✨ Nouveautés',
          value: [
            '**🎁 Super Bonuses**',
            '• 11 types de bonus différents disponibles dans les Mystery Boxes',
            '• Effets puissants : multiplicateurs, protections, avantages uniques',
            '• Système cumulatif : les charges s\'additionnent, les durées s\'étendent',
            '',
            '**📊 Système de Probabilités Avancé**',
            '• Les Mystery Boxes utilisent maintenant un système de probabilités en 2 niveaux',
            '• Meilleur équilibre entre items communs et légendaires',
            '• Plus de variété dans vos récompenses'
          ].join('\n'),
          inline: false
        },
        {
          name: '🔜 À Venir',
          value: [
            '• Tests et optimisations de chaque bonus individuellement',
            '• Ajustements d\'équilibrage basés sur vos retours',
            '• Nouvelles mécaniques de jeu surprenantes'
          ].join('\n'),
          inline: false
        },
        {
          name: '💡 Comment en profiter ?',
          value: 'Continuez à ouvrir vos Mystery Boxes pour découvrir les nouveaux Super Bonuses! Chaque boîte peut maintenant contenir des récompenses encore plus puissantes.',
          inline: false
        }
      )
      .setFooter({
        text: 'Monopoly GO Friends • v1.4.0',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    console.log('✅ Annonce postée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la publication:', error);
    process.exit(1);
  }
}

postAnnouncement();
