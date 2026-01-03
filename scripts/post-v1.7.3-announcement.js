const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Salon annonces trouvé via read-message-rest.js
const CHANNEL_ID = '1248176835490091110';

async function postAnnouncement() {
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('Bot connecte');

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('Canal non trouve');
      process.exit(1);
    }

    // EMBED UNIQUE: Annonce joueurs
    const embed = new EmbedBuilder()
      .setColor(0x5865F2) // Bleu Discord
      .setTitle('🔧 MISE À JOUR v1.7.3 - Corrections & Améliorations')
      .setDescription(`Salut à tous ! 👋

Une mise à jour a été déployée avec plusieurs **corrections importantes** qui améliorent votre expérience de jeu !`)
      .addFields(
        {
          name: '🏆 **Badges Corrigés**',
          value: `• Le bouton **"Voir mes badges"** dans les DM fonctionne maintenant correctement
• Les **badges Super Bonus** se débloquent enfin comme prévu
• Vos progressions sont correctement trackées !`,
          inline: false
        },
        {
          name: '👑 **Attribution des Rôles**',
          value: `Le **rôle de complétion** est maintenant attribué de façon fiable quand vous complétez votre collection !

> Plus de souci après un redémarrage du bot.`,
          inline: false
        },
        {
          name: '🎯 **Missions Améliorées**',
          value: `• Les missions **"Mot à Deviner"** ne restent plus bloquées
• Les **quiz** fonctionnent mieux avec leurs propres questions
• Expérience plus fluide globalement !`,
          inline: false
        },
        {
          name: '📦 **Inventaire**',
          value: `La **pagination de l'inventaire** fonctionne correctement sur toutes les pages.`,
          inline: false
        },
        {
          name: '🐛 **Signaler un Bug**',
          value: `Un souci ? Signalez-le dans <#1428022920743092284>

**Bon jeu à tous !** 🎮✨`,
          inline: false
        }
      )
      .setFooter({
        text: 'Version 1.7.3 • 2025-11-22 • Merci pour vos retours ! ❤️'
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log('✅ Annonce v1.7.3 complète postée avec succès dans #annonces !');
    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

postAnnouncement();
