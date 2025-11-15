const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const ANNOUNCEMENT_CHANNEL_ID = '1433850027364847646';

/**
 * Annonce pour la version 1.2.0 - Système de Branding Complet avec Footer Loomix
 */
async function postAnnouncement() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    console.log('🤖 Connexion au bot Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      throw new Error(`Channel ${ANNOUNCEMENT_CHANNEL_ID} introuvable`);
    }

    console.log(`📢 Channel trouvé: ${channel.name}\n`);

    // Embed principal
    const mainEmbed = new EmbedBuilder()
      .setTitle('🎨 Mise à jour v1.2.0 - Système de Branding Loomix')
      .setDescription(
        '**Une mise à jour majeure du système de personnalisation est maintenant disponible !**\n\n' +
        'Tous les embeds du bot affichent maintenant un branding uniforme et professionnel powered by **Loomix Bot**.'
      )
      .setColor('#3498DB')
      .addFields(
        {
          name: '✨ Nouveautés',
          value:
            '🏷️ **Footer Loomix imposé sur tous les embeds**\n' +
            '> Format: `{votre texte} • Powered by Loomix Bot`\n' +
            '> Logo Loomix affiché automatiquement\n' +
            '> 35+ embeds mis à jour à travers tout le bot\n\n' +
            '🎨 **Système de couleurs amélioré**\n' +
            '> 32 couleurs avec noms lisibles (fini les codes hex !)\n' +
            '> 5 palettes distinctes de sélection\n' +
            '> Affichage avec emojis colorés\n\n' +
            '🤖 **Labels clarifiés dans `/server-config`**\n' +
            '> "Couleur du bot" au lieu de "Couleur principale"\n' +
            '> "Couleur des embeds" au lieu de "Couleur secondaire"\n' +
            '> Interface plus intuitive et professionnelle',
          inline: false
        },
        {
          name: '📋 Détails techniques',
          value:
            '**Fichiers modifiés**: 8 fichiers principaux\n' +
            '**Embeds mis à jour**: 35+\n' +
            '**Couleurs ajoutées**: 32\n' +
            '**Nouveau helper**: `utils/footerHelper.js`',
          inline: false
        },
        {
          name: '🎯 Impact',
          value:
            '✅ Cohérence visuelle sur tout le bot\n' +
            '✅ Branding professionnel Loomix Bot\n' +
            '✅ Interface `/server-config` plus claire\n' +
            '✅ Expérience utilisateur améliorée',
          inline: false
        }
      )
      .setFooter({
        text: 'monopolygo friends • Powered by Loomix Bot',
        iconURL: 'https://avatars.githubusercontent.com/u/241378179?s=400&u=fb81108da6b3639fae0f2a9335d01ca07bb0ddc5&v=4'
      })
      .setTimestamp();

    // Embed des palettes de couleurs
    const colorsEmbed = new EmbedBuilder()
      .setTitle('🌈 Palettes de Couleurs Disponibles')
      .setDescription('5 catégories distinctes pour personnaliser votre bot')
      .setColor('#9B59B6')
      .addFields(
        {
          name: '🎨 Basiques + Tendances 2025',
          value: '16 couleurs classiques et modernes',
          inline: true
        },
        {
          name: '🌸 Couleurs Pastel',
          value: '6 couleurs douces et élégantes',
          inline: true
        },
        {
          name: '⚡ Couleurs Vives',
          value: '5 couleurs néon électriques',
          inline: true
        },
        {
          name: '💼 Professionnelles',
          value: '5 couleurs corporate',
          inline: true
        },
        {
          name: '🔢 Personnalisé',
          value: 'Code hexadécimal sur mesure',
          inline: true
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: true
        }
      )
      .addFields({
        name: '💡 Exemple',
        value:
          'Au lieu de voir `#E74C3C`, vous verrez maintenant:\n' +
          '`🔥 Rouge Cardinal`\n\n' +
          'Plus lisible et plus visuel !',
        inline: false
      })
      .setFooter({
        text: 'monopolygo friends • Powered by Loomix Bot',
        iconURL: 'https://avatars.githubusercontent.com/u/241378179?s=400&u=fb81108da6b3639fae0f2a9335d01ca07bb0ddc5&v=4'
      });

    console.log('📨 Envoi de l\'annonce...\n');

    await channel.send({
      content: '📢 **Nouvelle mise à jour disponible !**',
      embeds: [mainEmbed, colorsEmbed]
    });

    console.log('✅ Annonce postée avec succès !');
    console.log(`📍 Channel: ${channel.name} (${ANNOUNCEMENT_CHANNEL_ID})`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await client.destroy();
    console.log('\n🔌 Bot déconnecté');
    process.exit(0);
  }
}

// Exécuter
postAnnouncement();
