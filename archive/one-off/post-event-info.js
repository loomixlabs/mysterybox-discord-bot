const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const INFO_CHANNEL = '1423822933607841863';

async function postEventInfo() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  client.once('ready', async () => {
    try {
      console.log(`🤖 Bot connecté: ${client.user.tag}\n`);

      const channel = await client.channels.fetch(INFO_CHANNEL);
      if (!channel) {
        console.error('❌ Salon introuvable');
        process.exit(1);
      }

      const infoEmbed = new EmbedBuilder()
        .setTitle('🏰 BIENVENUE DANS L\'UNIVERS DE BLANCHE-NEIGE')
        .setDescription(
          'Notre serveur a été transformé en un royaume enchanté où tu vas pouvoir retrouver les **7 nains** disparus dans la forêt !\n\n' +
          '**Pendant les 20 prochains jours**, des boîtes mystérieuses apparaîtront dans les canaux du serveur.'
        )
        .addFields(
          {
            name: '🎁 LES 7 NAINS - À retrouver et collectionner',
            value: '• Prof, Simplet, Dormeur, Atchoum, Joyeux, Timide et Grincheux\n' +
                   '• Chaque nain trouvé te rapproche de la collection complète !\n' +
                   '• **7 nains uniques** à découvrir',
            inline: false
          },
          {
            name: '📋 MISSIONS - Défis thématiques',
            value: '• Quiz sur le conte de Blanche-Neige\n' +
                   '• Défis créatifs et interactifs\n' +
                   '• Récompenses bonus pour les plus malins !',
            inline: false
          },
          {
            name: '⚠️ PIÈGES - Attention où tu mets les pieds !',
            value: '• **Cooldown temporaire** : tu ne pourras pas ouvrir de boîte pendant un certain temps\n' +
                   '• **Perte d\'un nain** : la reine peut te voler l\'un de tes précieux nains !\n' +
                   '• Reste vigilant et stratégique !',
            inline: false
          }
        )
        .setColor('#FFD700');

      const rewardsEmbed = new EmbedBuilder()
        .setTitle('🎯 TON OBJECTIF')
        .setDescription(
          'Sois parmi les premiers à retrouver **LES 7 NAINS** pour obtenir le rôle légendaire et ses avantages exclusifs !'
        )
        .addFields(
          {
            name: '🏆 RÉCOMPENSES FINALES',
            value: '• 👑 **Rôle "Blanche neige"** exclusif\n' +
                   '• 🎁 **Participations supplémentaires** aux giveaways du serveur\n' +
                   '• 🌟 Reconnaissance éternelle dans le royaume !',
            inline: false
          },
          {
            name: '⚡ COMMANDES DISPONIBLES',
            value: '📊 `/profile` → Consulte ta progression et tes nains trouvés\n' +
                   '🏅 `/leaderboard` → Classement des meilleurs collectionneurs\n' +
                   '⏰ `/my-bonuses` → Vérifie tes pénalités actives',
            inline: false
          },
          {
            name: '💡 ASTUCES & STRATÉGIES',
            value: '✅ Sois rapide ! Les boîtes sont limitées\n' +
                   '✅ Utilise ta connaissance du conte pour les quiz\n' +
                   '✅ Évite les pièges de la méchante reine\n' +
                   '✅ Reste actif sur le serveur pour ne rien manquer',
            inline: false
          }
        )
        .setColor('#00FF00')
        .setFooter({ text: '"Miroir, mon beau miroir, qui est le meilleur collectionneur ?"' });

      await channel.send({ embeds: [infoEmbed, rewardsEmbed] });
      console.log(`✅ Informations de l'événement postées dans: ${channel.name}\n`);

      process.exit(0);
    } catch (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

postEventInfo();
