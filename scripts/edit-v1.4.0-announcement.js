const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

async function editAnnouncement() {
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté');

    const channelId = '1248176835490091110';
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      throw new Error(`Canal ${channelId} introuvable`);
    }

    console.log(`📢 Canal trouvé: ${channel.name}`);

    // Récupérer les derniers messages pour trouver l'annonce
    const messages = await channel.messages.fetch({ limit: 10 });
    const announcementMessage = messages.find(m =>
      m.author.id === client.user.id &&
      m.embeds.length > 0 &&
      m.embeds[0].title?.includes('v1.4.0')
    );

    if (!announcementMessage) {
      throw new Error('Message d\'annonce v1.4.0 introuvable');
    }

    console.log(`📝 Message trouvé: ${announcementMessage.id}`);

    const embed = new EmbedBuilder()
      .setColor('#00D9FF')
      .setTitle('🎉 Mise à Jour v1.4.0 - Système de Probabilités Avancé')
      .setDescription('Nous avons amélioré le système de mystery boxes avec un nouveau moteur de probabilités!')
      .addFields(
        {
          name: '✨ Nouveautés Disponibles',
          value: [
            '**📊 Système de Probabilités en 2 Niveaux**',
            '• Configuration fine de la distribution des mystery boxes',
            '• **Niveau 1**: Probabilité par type (Collectibles, Missions, Pièges, Super Bonuses)',
            '• **Niveau 2**: Probabilité par rareté pour chaque type',
            '  - Collectibles: Legendary, Epic, Rare, Common',
            '  - Super Bonuses: Legendary, Epic, Rare, Common',
            '',
            '**🎯 Meilleur Équilibrage du Jeu**',
            '• Distribution plus équitable des récompenses',
            '• Plus de variété dans vos mystery boxes',
            '• Système évolutif selon vos retours'
          ].join('\n'),
          inline: false
        },
        {
          name: '🔜 À Venir Prochainement',
          value: [
            '**✨ Super Bonuses** (Système en préparation)',
            '• 11 types de bonus puissants en développement',
            '• Effets spéciaux: multiplicateurs, protections, avantages uniques',
            '• Système de cumul intelligent (charges + durées)',
            '',
            '**🎮 Autres Améliorations**',
            '• Tests et optimisations continues',
            '• Ajustements d\'équilibrage basés sur vos retours',
            '• Nouvelles mécaniques de jeu surprenantes'
          ].join('\n'),
          inline: false
        },
        {
          name: '🔧 Travail Technique Effectué',
          value: [
            '• Nouveau moteur de probabilités multi-niveaux',
            '• Base de données optimisée pour les super bonuses',
            '• Interface admin complète de configuration',
            '• Système de validation stricte (total = 100%)',
            '• Architecture prête pour les futures fonctionnalités'
          ].join('\n'),
          inline: false
        },
        {
          name: '💡 Ce Qui Change Pour Vous',
          value: 'Le système de mystery boxes utilise maintenant un algorithme plus sophistiqué pour garantir une meilleure distribution des récompenses. Vous devriez constater une meilleure variété dans vos boîtes!',
          inline: false
        }
      )
      .setFooter({
        text: 'Monopoly GO Friends • v1.4.0',
        iconURL: client.user.displayAvatarURL()
      })
      .setTimestamp();

    await announcementMessage.edit({ embeds: [embed] });

    console.log('✅ Annonce éditée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'édition:', error);
    process.exit(1);
  }
}

editAnnouncement();
