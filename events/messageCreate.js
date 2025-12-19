const db = require('../utils/database-pg');
const { EmbedBuilder } = require('discord.js');
const announcements = require('../utils/announcements');
const quizAnswerMatcher = require('../utils/quizAnswerMatcher');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // Ignorer les messages des bots
    if (message.author.bot) return;

    // Ignorer les messages privés
    if (!message.guild) return;

    try {
      // Récupérer toutes les missions "mot deviné" actives dans ce canal
      const activeMissions = await db.getActiveKeywordMissionsInChannel(
        message.guild.id,
        message.channel.id
      );

      if (!activeMissions || activeMissions.length === 0) return;

      // Normaliser le message complet pour comparaison (gère les accents)
      const normalizedMessage = quizAnswerMatcher.normalizeAnswer(message.content);

      // Pour chaque mission active, vérifier si le mot-clé correspond
      for (const missionProgress of activeMissions) {
        // IMPORTANT: Vérifier que la mission n'est pas déjà terminée
        if (missionProgress.status === 'completed' || missionProgress.status === 'failed') {
          console.log(`⏭️ Mission ${missionProgress.id} déjà traitée (status: ${missionProgress.status})`);
          continue;
        }

        // Normaliser le mot-clé de la mission (gère les accents)
        const normalizedKeyword = quizAnswerMatcher.normalizeAnswer(missionProgress.target_keyword);

        // Vérifier si le message contient le mot-clé (avec tolérance accents)
        // Utiliser une regex pour trouver le mot comme mot entier
        const keywordRegex = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

        if (!keywordRegex.test(normalizedMessage)) {
          // Essayer aussi avec matchAnswer pour plus de tolérance
          const matchResult = quizAnswerMatcher.matchAnswer(message.content, missionProgress.target_keyword);
          if (!matchResult.isCorrect && !matchResult.isClose) {
            continue; // Pas de correspondance
          }
        }

        // Match trouvé ! Le mot du message est le mot-clé original (pour l'affichage)
        const matchedWord = missionProgress.target_keyword;

        // Récupérer le joueur (propriétaire de la mission)
        const missionOwner = await db.getPlayer(message.guild.id, missionProgress.player_id);
        if (!missionOwner) continue;

        console.log(`🔤 Mot-clé détecté: "${matchedWord}" (normalisé: "${normalizedKeyword}") pour mission ${missionProgress.id}`);

        // CAS 1: Le propriétaire de la mission dit le mot lui-même → ÉCHEC
        // IMPORTANT: Comparer avec discord_id, pas player_id (qui est un INTEGER de la DB)
        if (message.author.id === missionOwner.discord_id) {
          await handleMissionFailure(message, missionProgress, missionOwner, matchedWord);
          break; // Traiter seulement UNE mission par mot-clé
        }
        // CAS 2: Un autre joueur dit le mot → SUCCÈS
        else {
          await handleMissionSuccess(message, missionProgress, missionOwner, matchedWord);
          break; // Traiter seulement UNE mission par mot-clé
        }
      }
    } catch (error) {
      console.error('🔴 Erreur dans messageCreate (keyword missions):', error);
    }
  }
};

/**
 * Gérer l'échec de la mission (le propriétaire a dit le mot)
 */
async function handleMissionFailure(message, missionProgress, missionOwner, keyword) {
  try {
    // Marquer la mission comme échouée ET mettre à jour l'objet en mémoire
    await db.query(
      `UPDATE mission_progress
       SET status = 'failed', updated_at = NOW()
       WHERE id = $1`,
      [missionProgress.id]
    );

    // IMPORTANT: Mettre à jour le statut en mémoire pour éviter les duplications
    missionProgress.status = 'failed';

    console.log(`❌ Mission mot-clé échouée: ${missionOwner.username} a dit le mot "${keyword}"`);

    // Récupérer les informations de la mission pour l'annonce
    const mission = await db.queryOne(
      'SELECT * FROM missions WHERE id = $1',
      [missionProgress.mission_id]
    );

    // Récupérer le thread AVANT d'envoyer le message
    const thread = await findMissionThread(message.guild, missionProgress, missionOwner);

    // Envoyer un message d'échec dans le thread (si trouvé)
    if (thread) {
      const threadFailEmbed = new EmbedBuilder()
        .setTitle('❌ Mission Échouée !')
        .setDescription(
          `Tu as dit le mot **"${keyword}"** toi-même dans le canal <#${message.channel.id}> !\n\n` +
          `💡 Tu devais faire dire ce mot à un **AUTRE joueur**.\n\n` +
          `⏱️ Ce thread se fermera dans 30 secondes...`
        )
        .setColor('#e74c3c')
        .setTimestamp();

      await thread.send({ embeds: [threadFailEmbed] });

      // Archiver le thread après 30 secondes
      setTimeout(async () => {
        try {
          await thread.setArchived(true);
          console.log(`✅ Thread mission_${missionProgress.id} archivé (échec)`);
        } catch (error) {
          console.warn('⚠️  Impossible d\'archiver le thread');
        }
      }, 30000);
    }

    // Envoyer aussi un message dans le canal (auto-supprimé après 15s)
    const failEmbed = new EmbedBuilder()
      .setTitle('❌ Mission Échouée !')
      .setDescription(
        `<@${missionOwner.discord_id}>, tu as dit le mot **"${keyword}"** toi-même !\n\n` +
        `💡 Tu devais faire dire ce mot à un AUTRE joueur.\n\n` +
        `La mission est échouée.`
      )
      .setColor('#e74c3c')
      .setFooter({ text: 'Ce message se supprimera dans 15 secondes' });

    const failMessage = await message.channel.send({ embeds: [failEmbed] });

    // Supprimer le message après 15 secondes
    setTimeout(async () => {
      try {
        await failMessage.delete();
      } catch (error) {
        console.warn('⚠️  Impossible de supprimer le message');
      }
    }, 15000);

    // Annonce : mission échouée
    await announcements.announceMissionFailed(
      message.client,
      message.guild.id,
      missionOwner.username,
      mission.name,
      `Le joueur a dit le mot "${keyword}" lui-même`
    );

  } catch (error) {
    console.error('🔴 Erreur lors de l\'échec de mission:', error);
  }
}

/**
 * Gérer le succès de la mission (un autre joueur a dit le mot)
 */
async function handleMissionSuccess(message, missionProgress, missionOwner, keyword) {
  try {
    // Marquer la mission comme complétée ET mettre à jour l'objet en mémoire
    await db.query(
      `UPDATE mission_progress
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [missionProgress.id]
    );

    // IMPORTANT: Mettre à jour le statut en mémoire pour éviter les duplications
    missionProgress.status = 'completed';

    console.log(`✅ Mission mot-clé réussie: ${message.author.username} a dit "${keyword}" pour ${missionOwner.username}`);

    // Récupérer les informations de la mission et du thème
    const mission = await db.queryOne(
      'SELECT * FROM missions WHERE id = $1',
      [missionProgress.mission_id]
    );

    const theme = await db.queryOne(
      'SELECT * FROM themes WHERE id = $1',
      [mission.theme_id]
    );

    // Récupérer un collectible aléatoire du thème
    const randomCollectible = await db.getRandomCollectible(message.guild.id, mission.theme_id);

    if (!randomCollectible) {
      const noItemEmbed = new EmbedBuilder()
        .setTitle('✅ Mission Réussie !')
        .setDescription(
          `Bravo <@${missionOwner.discord_id}> !\n\n` +
          `${message.author.username} a dit le mot **"${keyword}"** !\n\n` +
          `⚠️ Malheureusement, aucun collectible n'est disponible pour le moment.`
        )
        .setColor('#f39c12')
        .setFooter({ text: 'Ce message se supprimera dans 15 secondes' });

      const noItemMessage = await message.channel.send({ embeds: [noItemEmbed] });

      // Supprimer après 15 secondes
      setTimeout(async () => {
        try {
          await noItemMessage.delete();
        } catch (error) {
          console.warn('⚠️  Impossible de supprimer le message');
        }
      }, 15000);

      return;
    }

    // Vérifier si le joueur l'a déjà
    const alreadyHas = await db.hasCollectible(
      message.guild.id,
      missionOwner.id,
      randomCollectible.id
    );

    // Ajouter le collectible si pas de doublon
    if (!alreadyHas) {
      await db.addCollectible(message.guild.id, missionOwner.id, randomCollectible.id, 'mission');
      const playerProgress = await db.incrementProgress(message.guild.id, missionOwner.id, mission.theme_id);

      // Message de récompense (auto-supprimé après 20s)
      const rewardEmbed = new EmbedBuilder()
        .setTitle('🎉 Mission Réussie !')
        .setDescription(
          `# Félicitations <@${missionOwner.discord_id}> !\n\n` +
          `✅ **${message.author.username}** a dit le mot **"${keyword}"** dans ce canal !\n\n` +
          `🎁 Tu as terminé la mission **${mission.name}** !`
        )
        .setColor('#2ecc71')
        .setThumbnail(randomCollectible.image_url)
        .addFields(
          {
            name: '🎁 Récompense',
            value: `**${randomCollectible.name}**`,
            inline: true
          },
          {
            name: '📊 Progression',
            value: `${playerProgress.collected_count}/${theme.required_items || 7}`,
            inline: true
          },
          {
            name: '⭐ Rareté',
            value: randomCollectible.rarity,
            inline: true
          }
        )
        .setFooter({ text: 'Ce message se supprimera dans 20 secondes' })
        .setTimestamp();

      const rewardMessage = await message.channel.send({ embeds: [rewardEmbed] });

      // Supprimer après 20 secondes
      setTimeout(async () => {
        try {
          await rewardMessage.delete();
        } catch (error) {
          console.warn('⚠️  Impossible de supprimer le message');
        }
      }, 20000);

      // Vérifier si collection complète
      if (playerProgress.collected_count >= theme.required_items && !playerProgress.is_completed) {
        await handleCollectionComplete(message, missionOwner, theme);
      }
    } else {
      // Doublon (auto-supprimé après 15s)
      const duplicateEmbed = new EmbedBuilder()
        .setTitle('⚠️ Mission réussie mais doublon !')
        .setDescription(
          `Bravo <@${missionOwner.discord_id}> !\n\n` +
          `✅ **${message.author.username}** a dit le mot **"${keyword}"** !\n\n` +
          `Tu as terminé la mission mais tu avais déjà **${randomCollectible.name}** dans ta collection !`
        )
        .setColor('#f39c12')
        .setThumbnail(randomCollectible.image_url)
        .setFooter({ text: 'Ce message se supprimera dans 15 secondes' });

      const duplicateMessage = await message.channel.send({ embeds: [duplicateEmbed] });

      // Supprimer après 15 secondes
      setTimeout(async () => {
        try {
          await duplicateMessage.delete();
        } catch (error) {
          console.warn('⚠️  Impossible de supprimer le message');
        }
      }, 15000);
    }

    // Annonce : mission réussie
    await announcements.announceMissionCompleted(
      message.client,
      message.guild.id,
      missionOwner.username,
      mission.name,
      randomCollectible.name
    );

    // Récupérer le thread de mission s'il existe
    const thread = await findMissionThread(message.guild, missionProgress, missionOwner);
    if (thread) {
      const threadSuccessEmbed = new EmbedBuilder()
        .setTitle('✅ Mission Réussie !')
        .setDescription(
          `Bravo ! Un autre joueur a dit le mot **"${keyword}"** dans <#${message.channel.id}> !\n\n` +
          `🎁 Tu as gagné : **${randomCollectible.name}** (${randomCollectible.rarity})\n\n` +
          `⏱️ Ce thread se fermera dans 30 secondes...`
        )
        .setColor('#2ecc71')
        .setThumbnail(randomCollectible.image_url)
        .setTimestamp();

      await thread.send({ embeds: [threadSuccessEmbed] });

      setTimeout(async () => {
        try {
          await thread.setArchived(true);
          console.log(`✅ Thread mission_${missionProgress.id} archivé (succès)`);
        } catch (error) {
          console.warn('⚠️  Impossible d\'archiver le thread');
        }
      }, 30000);
    }

  } catch (error) {
    console.error('🔴 Erreur lors du succès de mission:', error);
  }
}

/**
 * Trouver le thread de mission pour le fermer
 * FIX BUG #2: Utiliser thread_id directement au lieu de chercher par nom
 */
async function findMissionThread(guild, missionProgress, missionOwner) {
  try {
    if (!missionProgress.thread_id) {
      console.log(`⚠️  Pas de thread_id pour la mission ${missionProgress.id} (${missionOwner.username})`);
      return null;
    }

    console.log(`🔍 Récupération du thread ${missionProgress.thread_id} pour ${missionOwner.username}`);

    // Utiliser guild.client.channels.fetch pour accéder directement à l'API Discord
    // guild.channels.fetch() utilise le cache et ne trouve pas les threads créés après le redémarrage
    const thread = await guild.client.channels.fetch(missionProgress.thread_id);

    if (thread) {
      console.log(`✅ Thread trouvé: "${thread.name}"`);
      return thread;
    } else {
      console.warn(`⚠️  Thread ${missionProgress.thread_id} est null`);
      return null;
    }
  } catch (error) {
    console.warn(`⚠️  Thread ${missionProgress.thread_id} introuvable:`, error.message);
    return null;
  }
}

/**
 * Gérer la complétion d'une collection complète
 */
async function handleCollectionComplete(message, player, theme) {
  try {
    await db.query(
      `UPDATE player_progress
       SET is_completed = TRUE, completed_at = NOW()
       WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3`,
      [message.guild.id, player.id, theme.id]
    );

    const completeEmbed = new EmbedBuilder()
      .setTitle('🎊 COLLECTION COMPLÈTE ! 🎊')
      .setDescription(
        `**${player.username}** a complété la collection du thème **${theme.name}** !\n\n` +
        `Félicitations pour avoir collecté tous les objets !`
      )
      .setColor('#FFD700');

    await message.channel.send({ embeds: [completeEmbed] });

    // Annonce globale
    await announcements.announceCollectionCompleted(
      message.client,
      message.guild.id,
      player.username,
      theme.name
    );

  } catch (error) {
    console.error('🔴 Erreur lors de la complétion de collection:', error);
  }
}
