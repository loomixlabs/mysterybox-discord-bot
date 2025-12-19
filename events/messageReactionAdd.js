const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/database-pg');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION DU MINI-JEU HARRY POTTER - Vif d'Or
// ═══════════════════════════════════════════════════════════════════════════

// ID du message du jeu (sera défini au lancement)
let HP_GAME_MESSAGE_ID = null;
const HP_GAME_CHANNEL_ID = '1189233124064895096'; // Canal avec la VRAIE IMAGE (déclenche le mini-jeu)
const HP_EMOJI = '🪄'; // Baguette magique
const HP_ROLE_ID = '1450244510054355167'; // Rôle "Sorcier Perspicace"

// Note: Canal 1339571870755717120 = Annonces officielles (message énigmatique avec indices)

module.exports = {
  name: Events.MessageReactionAdd,

  /**
   * Définir l'ID du message du jeu HP
   */
  setHPGameMessageId(messageId) {
    HP_GAME_MESSAGE_ID = messageId;
    console.log(`⚡ Jeu Harry Potter activé sur le message ${messageId}`);
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

      // Vérifier si c'est le message du jeu Harry Potter
      if (reaction.message.id !== HP_GAME_MESSAGE_ID) return;
      if (reaction.message.channelId !== HP_GAME_CHANNEL_ID) return;

      // Supprimer la réaction immédiatement (mystère total)
      try {
        await reaction.users.remove(user.id);
      } catch (error) {
        console.error('❌ Erreur lors de la suppression de la réaction:', error);
      }

      // Vérifier si c'est la bonne réaction (⚡)
      if (reaction.emoji.name !== HP_EMOJI) {
        console.log(`❌ ${user.tag} a réagi avec ${reaction.emoji.name} (mauvais emoji)`);
        return;
      }

      console.log(`⚡ ${user.tag} a réagi avec ⚡ !`);

      // Vérifier si le joueur a déjà gagné (on utilise la même table apple_game_winners)
      const alreadyWon = await db.queryOne(
        `SELECT id FROM apple_game_winners
         WHERE user_id = $1 AND guild_id = $2`,
        [user.id, reaction.message.guildId]
      );

      if (alreadyWon) {
        console.log(`⚠️ ${user.tag} a déjà gagné le jeu Harry Potter`);
        return;
      }

      // Enregistrer le gagnant
      await db.query(
        `INSERT INTO apple_game_winners (user_id, guild_id, won_at)
         VALUES ($1, $2, NOW())`,
        [user.id, reaction.message.guildId]
      );

      // Attribuer le rôle "Attrapeur de Vif d'Or"
      const guild = reaction.message.guild;
      try {
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(HP_ROLE_ID);

        if (role) {
          await member.roles.add(role);
          console.log(`🧙 Rôle "${role.name}" attribué à ${user.tag}`);
        } else {
          console.error('❌ Rôle HP introuvable');
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'attribution du rôle à ${user.tag}:`, error.message);
      }

      // Créer les embeds de félicitations Harry Potter
      const congratsEmbed = new EmbedBuilder()
        .setTitle('🪄 FÉLICITATIONS, SORCIER PERSPICACE ! 🪄')
        .setDescription(
          '**Tu as trouvé la Baguette de Sureau !**\n\n' +
          'Parmi toutes les baguettes dispersées dans les couloirs de Poudlard, tu as su reconnaître la plus puissante de toutes... ' +
          'La Baguette de Sureau, l\'une des trois **Reliques de la Mort** !\n\n' +
          '🧙 **Tu reçois le rôle exclusif "Sorcier Perspicace"**\n' +
          'Ce titre marque ton entrée officielle dans l\'école de magie de Poudlard !'
        )
        .setColor('#9B59B6')
        .setThumbnail('http://72.60.185.62:8080/hp-images/Gemini_Generated_Image_iv93dwiv93dwiv93.png');

      const infoEmbed = new EmbedBuilder()
        .setTitle('🏰 BIENVENUE À POUDLARD - Comment ça marche ?')
        .setDescription(
          'Le Choixpeau t\'a jugé digne ! Voici comment fonctionne ta quête de sorcier...\n\n' +
          '**📦 DES BOÎTES MYSTÉRIEUSES** apparaîtront régulièrement dans les salons du serveur. ' +
          'Clique sur le bouton **"Ouvrir"** pour découvrir ce qu\'elles contiennent !'
        )
        .addFields(
          {
            name: '🎁 QUE CONTIENNENT LES BOÎTES ?',
            value: '**🏆 Reliques Magiques** → Collecte les 22 objets pour compléter ta collection !\n' +
                   '• 3 **Légendaires** (Baguette de Sureau, Pierre de Résurrection, Cape d\'Invisibilité)\n' +
                   '• 5 **Épiques** (Carte du Maraudeur, Éclair de Feu, Choixpeau...)\n' +
                   '• 6 **Rares** (Vif d\'Or, Nimbus 2000, Pensine...)\n' +
                   '• 8 **Communs** (Écharpes des maisons, Chocogrenouille...)\n\n' +
                   '**⚠️ Maléfices** → Attention aux pièges des forces du mal !\n' +
                   '• 💀 **Avada Kedavra** - Perte de TOUS tes objets\n' +
                   '• 🦇 **Maléfice de Chauve-Furie** - Perte d\'un objet aléatoire\n' +
                   '• 💀 **Baiser du Détraqueur** - Cooldown temporaire\n' +
                   '• 📣 **Beuglante de Molly** - Humiliation publique',
            inline: false
          },
          {
            name: '📜 MISSIONS - Épreuves du Tournoi',
            value: 'Des **missions** seront postées régulièrement :\n' +
                   '• **Quiz** sur l\'univers Harry Potter\n' +
                   '• **Mots à deviner** (sortilèges, créatures magiques...)\n' +
                   '• **Puzzle Emoji** à décrypter\n' +
                   '• **Vrai ou Faux** sur le monde des sorciers\n' +
                   '• Récompenses : reliques garanties ou super bonus !',
            inline: false
          },
          {
            name: '✨ SUPER BONUS - Pouvoirs Spéciaux',
            value: 'Tu peux gagner des **bonus temporaires** très puissants :\n' +
                   '• 👁️ **Vision Divine** - Voir le contenu des boîtes avant de les ouvrir\n' +
                   '• 🛡️ **Bouclier Anti-Piège** - Annule le prochain maléfice reçu\n' +
                   '• 🧲 **Aimant à Légendaires** - Augmente tes chances de légendaires\n' +
                   '• 💰 **Jackpot x2** - Double ta prochaine trouvaille',
            inline: false
          }
        )
        .setColor('#740001'); // Rouge Gryffondor

      const rewardsEmbed = new EmbedBuilder()
        .setTitle('🏆 OBJECTIF & RÉCOMPENSES')
        .setDescription(
          'Sois parmi les premiers à rassembler **TOUTES LES RELIQUES** pour devenir un **Maître Sorcier** !'
        )
        .addFields(
          {
            name: '🎖️ RÔLES DE PROGRESSION',
            value: 'Plus tu collectes, plus tu montes en grade :\n' +
                   '• **Apprenti Sorcier** → Première relique collectée\n' +
                   '• **Sorcier Confirmé** → 50% de la collection\n' +
                   '• **Maître Sorcier** → Collection complète (22/22)\n' +
                   '→ Chaque rôle débloque des **participations bonus aux giveaways** !',
            inline: false
          },
          {
            name: '🏅 BADGES & SUCCÈS',
            value: 'Débloque des **badges** en accomplissant des défis :\n' +
                   '• Ouvrir X boîtes mystérieuses\n' +
                   '• Collecter toutes les reliques d\'une rareté\n' +
                   '• Utiliser des super bonus\n' +
                   '• Survivre aux maléfices\n' +
                   '• Et bien d\'autres...',
            inline: false
          },
          {
            name: '📱 COMMANDES',
            value: '📊 `/profile` → Ta progression complète\n' +
                   '  ↳ Inventaire, bonus actifs, historique, badges, personnalisation\n' +
                   '🏅 `/leaderboard` → Classement des meilleurs collectionneurs',
            inline: false
          },
          {
            name: '💡 CONSEILS DE DUMBLEDORE',
            value: '✅ Sois rapide ! Les boîtes disparaissent après un certain temps\n' +
                   '✅ Garde tes super bonus pour les moments stratégiques\n' +
                   '✅ Participe aux missions pour des récompenses garanties\n' +
                   '✅ *"Ce sont nos choix qui montrent ce que nous sommes vraiment"*',
            inline: false
          }
        )
        .setColor('#1A472A') // Vert Serpentard
        .setFooter({ text: '⚡ Que la magie soit avec toi, jeune sorcier !' });

      // Envoyer les embeds au gagnant
      try {
        await user.send({ embeds: [congratsEmbed, infoEmbed, rewardsEmbed] });
        console.log(`✅ MP envoyé à ${user.tag} !`);

        // Log dans la console du serveur
        console.log(`🎉 ${user.tag} (${user.id}) a attrapé le Vif d'Or dans ${guild.name} !`);

      } catch (error) {
        console.error(`❌ Impossible d'envoyer le MP à ${user.tag}:`, error.message);
      }

    } catch (error) {
      console.error('❌ Erreur dans messageReactionAdd:', error);
    }
  }
};
