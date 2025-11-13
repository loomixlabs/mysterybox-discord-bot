const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

// ID du message du jeu de la pomme (sera défini au lancement)
let APPLE_GAME_MESSAGE_ID = null;
const APPLE_GAME_CHANNEL_ID = '1428022811078688904';
const APPLE_EMOJI = '🍎';
const ENIGMATIC_HUNTER_ROLE_ID = '1437868343095722217';

module.exports = {
  name: Events.MessageReactionAdd,

  /**
   * Définir l'ID du message du jeu
   */
  setAppleGameMessageId(messageId) {
    APPLE_GAME_MESSAGE_ID = messageId;
    console.log(`🍎 Jeu de la pomme activé sur le message ${messageId}`);
  },

  async execute(reaction, user) {
    try {
      // Ignorer les réactions du bot
      if (user.bot) return;

      // Fetch le message et la réaction si partiels
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          console.error('❌ Erreur lors du fetch de la réaction:', error);
          return;
        }
      }

      // Vérifier si c'est le message du jeu de la pomme
      if (reaction.message.id !== APPLE_GAME_MESSAGE_ID) return;
      if (reaction.message.channelId !== APPLE_GAME_CHANNEL_ID) return;

      // Supprimer la réaction immédiatement (mystère total)
      try {
        await reaction.users.remove(user.id);
      } catch (error) {
        console.error('❌ Erreur lors de la suppression de la réaction:', error);
      }

      // Vérifier si c'est la bonne réaction (🍎)
      if (reaction.emoji.name !== APPLE_EMOJI) {
        console.log(`❌ ${user.tag} a réagi avec ${reaction.emoji.name} (mauvais emoji)`);
        return;
      }

      console.log(`🍎 ${user.tag} a réagi avec 🍎 !`);

      // Vérifier si le joueur a déjà gagné
      const alreadyWon = await db.queryOne(
        `SELECT id FROM apple_game_winners
         WHERE user_id = $1 AND guild_id = $2`,
        [user.id, reaction.message.guildId]
      );

      if (alreadyWon) {
        console.log(`⚠️ ${user.tag} a déjà gagné le jeu de la pomme`);
        return;
      }

      // Enregistrer le gagnant
      await db.query(
        `INSERT INTO apple_game_winners (user_id, guild_id, won_at)
         VALUES ($1, $2, NOW())`,
        [user.id, reaction.message.guildId]
      );

      // Attribuer le rôle "Chasseur énigmatique"
      const guild = reaction.message.guild;
      try {
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(ENIGMATIC_HUNTER_ROLE_ID);

        if (role) {
          await member.roles.add(role);
          console.log(`🕵️ Rôle "Chasseur énigmatique" attribué à ${user.tag}`);
        } else {
          console.error('❌ Rôle "Chasseur énigmatique" introuvable');
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'attribution du rôle à ${user.tag}:`, error.message);
      }

      // Créer l'embed de félicitations
      const congratsEmbed = new EmbedBuilder()
        .setTitle('🍎 FÉLICITATIONS ! 🍎')
        .setDescription(
          '**Tu as découvert la pomme enchantée !**\n\n' +
          'Comme dans le conte de Blanche-Neige, cette pomme n\'était pas qu\'un simple fruit... ' +
          'Elle renferme un secret magique que seuls les plus astucieux peuvent découvrir !\n\n' +
          '🕵️ **Tu reçois le rôle exclusif "Chasseur énigmatique"**\n' +
          'Ce titre marque ton appartenance à une élite de détectives qui ont su déjouer les pièges et trouver le véritable arbre mystérieux !'
        )
        .setColor('#FF0000')
        .setThumbnail('https://popcinema.fr/wp-content/uploads/2025/05/Disney-vs-Pixar-Quel-studio-a-vraiment-le-meilleur-film-.png');

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

      // Envoyer les embeds au gagnant
      try {
        await user.send({ embeds: [congratsEmbed, infoEmbed, rewardsEmbed] });
        console.log(`✅ MP envoyé à ${user.tag} !`);

        // Log dans la console du serveur
        console.log(`🎉 ${user.tag} (${user.id}) a trouvé la pomme enchantée dans ${guild.name} !`);

      } catch (error) {
        console.error(`❌ Impossible d'envoyer le MP à ${user.tag}:`, error.message);
      }

    } catch (error) {
      console.error('❌ Erreur dans messageReactionAdd:', error);
    }
  }
};
