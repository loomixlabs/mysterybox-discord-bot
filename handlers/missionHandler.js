const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const announcements = require('../utils/announcements');
const badgeHandler = require('./badgeHandler');
const progressionRoleHandler = require('./progressionRoleHandler');
const audit = require('../utils/auditLogger');
const { getLoomixFooter, getLoomixFooterWithCustomText } = require('../utils/footerHelper');
const quizAnswerMatcher = require('../utils/quizAnswerMatcher');
const threadManager = require('../utils/threadManager');

/**
 * Handler pour le système de missions V2
 * Compatible avec le système de boîte mystère
 */
class MissionHandler {

  /**
   * Joueur clique sur "🎯 Lancer la mission/quiz" - NOUVEAU FLOW
   */
  async handleMissionStart(interaction) {
    await interaction.deferUpdate();
    const [, , missionId, playerId] = interaction.customId.split('_');

    try {
      // Vérifier que c'est bien le bon joueur
      if (interaction.user.id !== playerId) {
        return interaction.followUp({
          content: '❌ Ce n\'est pas ta mission !'
        });
      }

      // Récupérer la mission
      const mission = await db.getMissionById(interaction.guildId, parseInt(missionId));

      if (!mission) {
        return interaction.followUp({
          content: '❌ Mission introuvable.'
        });
      }

      // Récupérer la progression
      const player = await db.getPlayerByDiscordId(interaction.guildId, interaction.user.id);
      const progress = await db.getActiveMissionProgress(interaction.guildId, player.id, mission.id);

      if (!progress) {
        return interaction.followUp({
          content: '❌ Progression de mission introuvable.'
        });
      }

      // Désactiver le bouton "Lancer"
      await interaction.editReply({
        components: []
      });

      // Lancer directement la validation selon le type
      console.log(`🎯 Mission lancée: ${mission.type} (${mission.validation_type})`);

      // Annonce : mission lancée
      await announcements.announceMissionStarted(
        interaction.client,
        interaction.guildId,
        interaction.user.username,
        mission.name,
        mission.validation_data?.time_limit || 'N/A'
      );

      switch (mission.validation_type) {
        case 'auto':
          await this.handleAutoValidation(interaction, mission, player, progress);
          break;

        case 'manual':
        default:
          await this.handleManualValidation(interaction, mission, player, progress);
          break;
      }

    } catch (error) {
      console.error('🔴 Erreur handleMissionStart:', error);

      // Utiliser followUp car l'interaction a été déférée
      const errorMessage = {
        content: '❌ Une erreur est survenue. Contacte un administrateur.'
      };

      try {
        await interaction.followUp(errorMessage);
      } catch (followUpError) {
        console.error('🔴 Impossible d\'envoyer le message d\'erreur:', followUpError.message);
      }
    }
  }

  /**
   * Joueur clique sur "✅ J'ai terminé" - ANCIEN FLOW (gardé pour compatibilité)
   */
  async handleMissionSubmit(interaction) {
    await interaction.deferUpdate();
    const [, , missionId, playerId] = interaction.customId.split('_');

    try {
      // Vérifier que c'est bien le bon joueur
      if (interaction.user.id !== playerId) {
        return interaction.reply({
          content: '❌ Ce n\'est pas ta mission !',
          flags: 64
        });
      }

      // Récupérer la mission
      const mission = await db.getMissionById(interaction.guildId, parseInt(missionId));

      if (!mission) {
        return interaction.reply({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      // Récupérer la progression
      const player = await db.getPlayerByDiscordId(interaction.guildId, interaction.user.id);
      const progress = await db.getActiveMissionProgress(interaction.guildId, player.id, mission.id);

      if (!progress) {
        return interaction.reply({
          content: '❌ Progression de mission introuvable.',
          flags: 64
        });
      }

      // Validation selon le type
      console.log(`🔍 Mission validation_type: "${mission.validation_type}", type: "${mission.type}"`);

      switch (mission.validation_type) {
        case 'auto':
          await this.handleAutoValidation(interaction, mission, player, progress);
          break;

        case 'manual':
        default:
          await this.handleManualValidation(interaction, mission, player, progress);
          break;
      }

    } catch (error) {
      console.error('🔴 Erreur handleMissionSubmit:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue. Contacte un administrateur.',
        flags: 64
      });
    }
  }

  /**
   * Auto-validation selon le type de mission
   */
  async handleAutoValidation(interaction, mission, player, progress) {
    // IMPORTANT: validation_data est déjà un objet (colonne JSONB de PostgreSQL)
    // Ne PAS utiliser JSON.parse() car cela causerait une erreur
    const validationData = mission.validation_data || {};

    console.log(`🔍 handleAutoValidation - mission.type = "${mission.type}"`);
    console.log(`🔍 validationData:`, validationData);

    switch (mission.type) {
      case 'keyword-message':
        console.log('✅ Matched keyword-message case');
        await this.validateKeywordMessage(interaction, mission, player, progress, validationData);
        break;

      case 'quiz':
        console.log('✅ Matched quiz case');
        await this.validateQuiz(interaction, mission, player, progress, validationData);
        break;

      case 'reaction':
        await this.validateReaction(interaction, mission, player, progress, validationData);
        break;

      case 'voice-join':
        await this.validateVoiceJoin(interaction, mission, player, progress, validationData);
        break;

      default:
        // Type inconnu, demander validation manuelle
        console.log('⚠️ Went to default case - calling handleManualValidation');
        await this.handleManualValidation(interaction, mission, player, progress);
        break;
    }
  }

  /**
   * Validation manuelle par admin
   */
  async handleManualValidation(interaction, mission, player, progress) {
    // Récupérer le branding
    const branding = await db.getGuildBranding(interaction.guildId);

    await interaction.followUp({
      content: '📤 Envoie maintenant ta preuve (screenshot, texte, lien, etc.) dans ce thread.\n\n⏰ Un administrateur la validera.'
    });

    // Attendre le prochain message du joueur
    const filter = m => m.author.id === interaction.user.id && !m.author.bot;
    const collector = interaction.channel.createMessageCollector({
      filter,
      max: 1,
      time: (mission.timeout || 30) * 60000
    });

    collector.on('collect', async msg => {
      // Stocker la preuve
      const proof = msg.content || msg.attachments.first()?.url || 'Message envoyé';

      await db.query(
        `UPDATE mission_progress
         SET status = 'submitted', submitted_proof = $1, updated_at = NOW()
         WHERE id = $2`,
        [proof, progress.id]
      );

      // Boutons pour les admins
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_approve_${progress.id}`)
          .setLabel('✅ Valider')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`mission_reject_${progress.id}`)
          .setLabel('❌ Refuser')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`thread_close_${interaction.channel.id}`)
          .setLabel('🔒 Fermer')
          .setStyle(ButtonStyle.Secondary)
      );

      // Récupérer les préférences de notification
      const notifySettings = await db.getMissionNotificationSettings(interaction.guildId);

      // Construire les mentions en fonction des préférences
      const mentionParts = [];

      // Mention des co-fondateurs (rôles)
      if (notifySettings.cofoundersMention) {
        const coFounderRoleIds = process.env.CO_FOUNDER_ROLE_ID?.split(',') || [];
        mentionParts.push(...coFounderRoleIds.map(id => `<@&${id.trim()}>`));
      }

      // Mention du propriétaire
      if (notifySettings.ownerMention) {
        mentionParts.push(`<@${interaction.guild.ownerId}>`);
      }

      // Mention des super-admins
      if (notifySettings.superAdminsMention) {
        const { SUPER_ADMINS } = require('../utils/permissions');
        mentionParts.push(...SUPER_ADMINS.map(id => `<@${id}>`));
      }

      const mentions = mentionParts.join(' ');
      const contentText = mentions
        ? `🔔 ${mentions} Mission en attente de validation !`
        : `🔔 Mission en attente de validation !`;

      await interaction.channel.send({
        content: contentText,
        embeds: [new EmbedBuilder()
          .setTitle('📋 Preuve soumise')
          .setDescription(`**Joueur:** <@${interaction.user.id}>\n**Mission:** ${mission.name}`)
          .setColor(branding.secondary_color)
          .setImage(msg.attachments.first()?.url || null)
          .setFooter(await getLoomixFooter(interaction.guildId))
        ],
        components: [buttons]
      });
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await interaction.channel.send(`⏰ **Temps écoulé !** Aucune preuve soumise. Le thread se ferme dans 5 secondes...`);

        // Marquer comme échouée
        await db.query(
          `UPDATE mission_progress SET status = 'failed', updated_at = NOW()
           WHERE id = $1`,
          [progress.id]
        );

        // Annonce : mission échouée
        await announcements.announceMissionFailed(
          interaction.client,
          interaction.guildId,
          interaction.user.username,
          mission.name,
          'Temps écoulé - Aucune preuve soumise'
        );

        // Fermer le thread après 5 secondes
        setTimeout(async () => {
          try {
            await interaction.channel.setArchived(true);
          } catch (error) {
            console.warn('⚠️  Impossible d\'archiver le thread');
          }
        }, 5000);
      }
    });
  }

  /**
   * Validation keyword-message - NEW VERSION
   * Le joueur doit faire DEVINER le mot à un autre joueur
   * Si le joueur dit le mot lui-même → mission échoue
   * Si un autre joueur dit le mot → mission réussie
   *
   * BUG FIX 15 (2025-11-21): UPDATE mission_progress AVANT les validations
   * pour éviter les missions bloquées avec target_channel_id/target_keyword NULL
   */
  async validateKeywordMessage(interaction, mission, player, progress, validationData) {
    let keyword = null;
    let difficulty = 'medium';
    let randomChannel = null;
    let hasError = false;
    let errorMessage = '';

    try {
      // Sélectionner un mot-clé aléatoire depuis la table mission_keywords
      const keywordData = await db.queryOne(
        `SELECT keyword, difficulty, target_channel_id
         FROM mission_keywords
         WHERE guild_id = $1 AND mission_id = $2
         ORDER BY RANDOM()
         LIMIT 1`,
        [interaction.guildId, mission.id]
      );

      if (!keywordData) {
        hasError = true;
        errorMessage = '❌ Aucun mot-clé configuré pour cette mission. Contacte un administrateur.';
      } else {
        keyword = keywordData.keyword;
        difficulty = keywordData.difficulty || 'medium';

        // Sélectionner les canaux disponibles en fonction de la configuration
        let textChannels = interaction.guild.channels.cache.filter(
          ch => ch.type === 0 && ch.permissionsFor(interaction.guild.members.me).has('ViewChannel')
        );

        // Si la mission a des canaux autorisés configurés, filtrer uniquement ceux-ci
        if (mission.allowed_channels && mission.allowed_channels.length > 0) {
          textChannels = textChannels.filter(ch => mission.allowed_channels.includes(ch.id));
          console.log(`📡 Mission avec canaux restreints: ${mission.allowed_channels.length} canaux autorisés, ${textChannels.size} disponibles`);
        } else {
          // Fallback: utiliser les canaux configurés pour les mystery boxes (give_channels)
          const giveChannels = await db.queryAll(
            'SELECT discord_id, type, parent_category_id FROM give_channels WHERE guild_id = $1',
            [interaction.guildId]
          );

          if (giveChannels && giveChannels.length > 0) {
            // Collecter tous les IDs de canaux autorisés (canaux directs + canaux dans les catégories)
            const allowedChannelIds = new Set();

            for (const gc of giveChannels) {
              if (gc.type === 'channel') {
                allowedChannelIds.add(gc.discord_id);
              } else if (gc.type === 'category') {
                // Ajouter tous les canaux texte de cette catégorie
                const categoryChannels = interaction.guild.channels.cache.filter(
                  ch => ch.type === 0 && ch.parentId === gc.discord_id
                );
                categoryChannels.forEach(ch => allowedChannelIds.add(ch.id));
              }
            }

            if (allowedChannelIds.size > 0) {
              textChannels = textChannels.filter(ch => allowedChannelIds.has(ch.id));
              console.log(`📦 Mission utilisant canaux mystery box par défaut: ${allowedChannelIds.size} canaux configurés, ${textChannels.size} disponibles`);
            } else {
              console.log(`🌐 Aucun canal mystery box valide, utilisant tous les canaux: ${textChannels.size} disponibles`);
            }
          } else {
            console.log(`🌐 Aucun canal mystery box configuré, utilisant tous les canaux: ${textChannels.size} disponibles`);
          }
        }

        if (textChannels.size === 0) {
          hasError = true;
          errorMessage = '❌ Aucun canal disponible pour cette mission.';
        } else {
          // Choisir un canal aléatoire parmi les canaux disponibles
          randomChannel = textChannels.random();
        }
      }

      // CRITIQUE: UPDATE mission_progress IMMÉDIATEMENT, même si erreur détectée
      // Cela évite les missions bloquées avec NULL (BUG 15)
      const timeoutSeconds = mission.timeout || 300;
      const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

      console.log(`🔍 [BUG 15 FIX] Updating mission_progress BEFORE validation checks`);
      console.log(`   progress.id=${progress.id}, keyword=${keyword || 'NULL'}, channel=${randomChannel?.id || 'NULL'}`);

      const updateResult = await db.query(
        `UPDATE mission_progress
         SET target_channel_id = $1,
             target_keyword = $2,
             mission_type = $3,
             expires_at = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, expires_at`,
        [randomChannel?.id || null, keyword, 'keyword-message', expiresAt, progress.id]
      );

      console.log(`✅ Mission mot-clé mission_progress updated:`, updateResult);

    } catch (error) {
      console.error('🔴 Erreur validateKeywordMessage (data fetch/update):', error);
      hasError = true;
      errorMessage = '❌ Erreur lors de la configuration de la mission.';
    }

    // Gérer les erreurs APRÈS l'UPDATE
    if (hasError) {
      await interaction.followUp({ content: errorMessage });

      // Si aucun canal disponible, fallback vers validation manuelle
      if (errorMessage.includes('canal disponible')) {
        return this.handleManualValidation(interaction, mission, player, progress);
      }

      return;
    }

    // Continuer avec le flow normal si pas d'erreur
    const difficultyEmojis = {
      'easy': '🟢',
      'medium': '🟡',
      'hard': '🔴'
    };
    const difficultyIcon = difficultyEmojis[difficulty] || '🟡';

    const timeoutSeconds = mission.timeout || 300;
    const timeoutDisplay = timeoutSeconds >= 60 && timeoutSeconds % 60 === 0
      ? `${timeoutSeconds / 60} minute${timeoutSeconds / 60 > 1 ? 's' : ''}`
      : `${timeoutSeconds} seconde${timeoutSeconds > 1 ? 's' : ''}`;

    console.log(`✅ Mission mot-clé démarrée: joueur=${interaction.user.id}, mot="${keyword}", difficulté=${difficulty}, canal=${randomChannel.name}`);

    // Informer le joueur des règles avec la difficulté
    await interaction.followUp({
      content: `🎯 **Mission: Faire deviner un mot !**\n\n` +
               `📝 Tu dois faire dire le mot **"${keyword}"** ${difficultyIcon} *(${difficulty})* à un autre joueur dans ${randomChannel}.\n\n` +
               `⚠️ **ATTENTION:** Si TU dis le mot toi-même, tu ÉCHOUERAS la mission !\n\n` +
               `⏰ Tu as **${timeoutDisplay}**.\n\n` +
               `💡 **Conseil:** Sois créatif pour amener la conversation vers ce mot sans le dire directement !`
    });

    // La validation sera gérée par le listener global messageCreate dans index.js
    // Pas besoin de collector local ici
  }

  /**
   * Validation quiz
   */
  async validateQuiz(interaction, mission, player, progress, validationData) {
    // Fetch a random quiz question from the database for this specific mission
    // Filtre par guild_id, mission_id ET theme_id pour une sécurité maximale
    const quizQuestion = await db.getRandomQuizQuestionByMission(interaction.guildId, mission.id, mission.theme_id);

    let question, answer, hint, difficulty, alternatives;

    if (quizQuestion) {
      // Use question from database
      question = quizQuestion.question_text;
      answer = quizQuestion.correct_answer;
      hint = quizQuestion.hint;
      difficulty = quizQuestion.difficulty || 'medium';
      // wrong_answers peut être utilisé comme réponses alternatives acceptées
      alternatives = quizQuestion.wrong_answers || [];

      console.log(`✅ Quiz question loaded from database: ${question}`);
    } else {
      // Fallback to validation_data if no questions in database
      console.log('⚠️  No quiz questions in database, using validation_data fallback');
      const data = validationData || {};
      question = data.question || 'Question par défaut';
      answer = data.answer || 'Réponse par défaut';
      hint = null;
      difficulty = 'medium';
      alternatives = data.alternatives || [];
    }

    // Convertir le timeout en unité appropriée pour l'affichage
    const timeoutSeconds = mission.timeout || 300; // Défaut: 5 minutes = 300 secondes
    const timeoutDisplay = timeoutSeconds >= 60 && timeoutSeconds % 60 === 0
      ? `${timeoutSeconds / 60} minute${timeoutSeconds / 60 > 1 ? 's' : ''}`
      : `${timeoutSeconds} seconde${timeoutSeconds > 1 ? 's' : ''}`;

    // Nombre d'essais (NULL = illimité)
    const maxAttempts = mission.max_attempts;
    const hasMaxAttempts = maxAttempts !== null && maxAttempts !== undefined;

    let questionText = `❓ **${question}**\n\nRéponds dans ce thread !`;
    if (hint) {
      questionText += `\n💡 **Indice:** ${hint}`;
    }

    // Afficher la difficulté
    const difficultyLabels = {
      'easy': 'Facile',
      'medium': 'Moyen',
      'hard': 'Difficile'
    };
    const difficultyLabel = difficultyLabels[difficulty] || 'Moyen';
    questionText += `\n📊 **Difficulté:** ${difficultyLabel}`;

    if (hasMaxAttempts) {
      questionText += `\n\n🎯 Tu as **${maxAttempts} essai${maxAttempts > 1 ? 's' : ''}** maximum.`;
    }
    questionText += `\n⏰ Tu as **${timeoutDisplay}**.`;

    await interaction.followUp({
      content: questionText
    });

    const filter = m => m.author.id === interaction.user.id;

    // Track attempts
    let attemptCount = 0;
    let missionCompleted = false;

    const collector = interaction.channel.createMessageCollector({
      filter,
      time: timeoutSeconds * 1000
      // Pas de max: 1 ici - on gère manuellement
    });

    collector.on('collect', async msg => {
      if (missionCompleted) return; // Mission déjà complétée, ignorer

      attemptCount++;
      const userAnswer = msg.content.trim();

      // Utiliser le matcher intelligent pour comparer les réponses
      const matchResult = quizAnswerMatcher.matchAnswer(userAnswer, answer, alternatives);

      if (matchResult.isCorrect) {
        // Bonne réponse !
        await msg.react('✅');
        missionCompleted = true;
        collector.stop('success');
        await this.completeMission(interaction, mission, player, progress, msg.url);
      } else if (matchResult.isClose) {
        // Réponse proche mais pas suffisante
        await msg.react('🔶');

        // Vérifier si le joueur a épuisé ses essais
        if (hasMaxAttempts && attemptCount >= maxAttempts) {
          // Tous les essais épuisés
          await interaction.channel.send(`❌ **Si proche !** Tu as épuisé tous tes essais (${maxAttempts}).\n\n${matchResult.feedback || 'Tu étais très proche !'}\n\nLa bonne réponse était : **${answer}**\n\nLe thread se ferme dans 5 secondes...`);

          collector.stop('failed');

          await db.query(
            `UPDATE mission_progress SET status = 'failed', updated_at = NOW()
             WHERE id = $1`,
            [progress.id]
          );

          // Annonce : mission échouée
          await announcements.announceMissionFailed(
            interaction.client,
            interaction.guildId,
            interaction.user.username,
            mission.name,
            `Échec au quiz (${maxAttempts} essais épuisés)`
          );

          // Fermer le thread après 5 secondes
          setTimeout(async () => {
            try {
              await interaction.channel.setArchived(true);
            } catch (error) {
              console.warn('⚠️  Impossible d\'archiver le thread');
            }
          }, 5000);
        } else {
          // Il reste des essais - donner un indice
          const remainingAttempts = hasMaxAttempts ? maxAttempts - attemptCount : null;

          let retryMessage = `🔶 **${matchResult.feedback || 'Tu es très proche !'}**`;

          if (hasMaxAttempts) {
            retryMessage += `\n\n🎯 Essais restants : **${remainingAttempts}/${maxAttempts}**`;
          }

          retryMessage += '\n\n💡 Réessaye en envoyant ta réponse dans ce thread.';

          await interaction.channel.send(retryMessage);
        }
      } else {
        // Mauvaise réponse
        await msg.react('❌');

        // Vérifier si le joueur a épuisé ses essais
        if (hasMaxAttempts && attemptCount >= maxAttempts) {
          // Tous les essais épuisés
          await interaction.channel.send(`❌ **Mauvaise réponse !** Tu as épuisé tous tes essais (${maxAttempts}).\n\nLa bonne réponse était : **${answer}**\n\nLe thread se ferme dans 5 secondes...`);

          collector.stop('failed');

          await db.query(
            `UPDATE mission_progress SET status = 'failed', updated_at = NOW()
             WHERE id = $1`,
            [progress.id]
          );

          // Annonce : mission échouée
          await announcements.announceMissionFailed(
            interaction.client,
            interaction.guildId,
            interaction.user.username,
            mission.name,
            `Échec au quiz (${maxAttempts} essais épuisés)`
          );

          // Fermer le thread après 5 secondes
          setTimeout(async () => {
            try {
              await interaction.channel.setArchived(true);
            } catch (error) {
              console.warn('⚠️  Impossible d\'archiver le thread');
            }
          }, 5000);
        } else {
          // Il reste des essais (ou essais illimités)
          const remainingAttempts = hasMaxAttempts ? maxAttempts - attemptCount : null;

          let retryMessage = '❌ **Mauvaise réponse !**';

          if (hasMaxAttempts) {
            retryMessage += `\n\n🎯 Essais restants : **${remainingAttempts}/${maxAttempts}**`;
          }

          retryMessage += '\n\n💡 Réessaye en envoyant ta réponse dans ce thread.';

          await interaction.channel.send(retryMessage);
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'success' || reason === 'failed') {
        // Mission déjà gérée (succès ou échec)
        return;
      }

      // Timeout - aucune bonne réponse dans le temps imparti
      if (attemptCount === 0) {
        await interaction.channel.send(`⏰ **Temps écoulé !** Aucune réponse reçue. Le thread se ferme dans 5 secondes...`);
      } else {
        await interaction.channel.send(`⏰ **Temps écoulé !** Tu n'as pas trouvé la bonne réponse à temps.\n\nLa bonne réponse était : **${answer}**\n\nLe thread se ferme dans 5 secondes...`);
      }

      await db.query(
        `UPDATE mission_progress SET status = 'failed', updated_at = NOW()
         WHERE id = $1`,
        [progress.id]
      );

      // Annonce : mission échouée
      await announcements.announceMissionFailed(
        interaction.client,
        interaction.guildId,
        interaction.user.username,
        mission.name,
        'Temps écoulé au quiz'
      );

      // Fermer le thread après 5 secondes
      setTimeout(async () => {
        try {
          await interaction.channel.setArchived(true);
        } catch (error) {
          console.warn('⚠️  Impossible d\'archiver le thread');
        }
      }, 5000);
    });
  }

  /**
   * Validation réaction (TODO)
   */
  async validateReaction(interaction, mission, player, progress, validationData) {
    // TODO: Implémenter la validation par réaction
    await this.handleManualValidation(interaction, mission, player, progress);
  }

  /**
   * Validation voice-join (TODO)
   */
  async validateVoiceJoin(interaction, mission, player, progress, validationData) {
    // TODO: Implémenter la validation par rejoindre vocal
    await this.handleManualValidation(interaction, mission, player, progress);
  }

  /**
   * Récupérer la récompense de la mission selon son type configuré
   * Types supportés: 'random-collectible', 'specific-collectible', 'super-bonus'
   * @param {string} guildId - ID du serveur
   * @param {object} mission - Mission avec reward_type et reward_data
   * @returns {object} { type: string, reward: object|null, name: string }
   */
  async getMissionReward(guildId, mission) {
    const rewardType = mission.reward_type || 'random-collectible';
    let rewardData = mission.reward_data;

    // Parser reward_data si c'est une string JSON
    if (typeof rewardData === 'string') {
      try {
        rewardData = JSON.parse(rewardData);
      } catch (e) {
        rewardData = {};
      }
    }
    rewardData = rewardData || {};

    console.log(`🎁 [MISSION REWARD] Type: ${rewardType}, Data:`, rewardData);

    switch (rewardType) {
      case 'specific-collectible': {
        // Récupérer un collectible spécifique par son collectible_id (string ID comme "pikachu")
        const collectibleId = rewardData.collectible_id || rewardData.collectibleId;
        if (!collectibleId) {
          console.warn('⚠️  [MISSION REWARD] specific-collectible mais pas de collectible_id - fallback random');
          const fallback = await db.getRandomCollectible(guildId, mission.theme_id);
          return { type: 'collectible', reward: fallback, name: fallback?.name || 'Collectible' };
        }

        // Chercher par collectible_id (string)
        const collectible = await db.queryOne(
          `SELECT * FROM collectibles
           WHERE guild_id = $1 AND theme_id = $2 AND collectible_id = $3`,
          [guildId, mission.theme_id, collectibleId]
        );

        if (!collectible) {
          console.warn(`⚠️  [MISSION REWARD] Collectible '${collectibleId}' introuvable - fallback random`);
          const fallback = await db.getRandomCollectible(guildId, mission.theme_id);
          return { type: 'collectible', reward: fallback, name: fallback?.name || 'Collectible' };
        }

        return { type: 'collectible', reward: collectible, name: collectible.name };
      }

      case 'super-bonus': {
        // Récupérer un super bonus aléatoire parmi ceux activés
        const superBonus = await db.queryOne(
          `SELECT * FROM super_bonuses
           WHERE guild_id = $1 AND is_enabled = true
           ORDER BY RANDOM() LIMIT 1`,
          [guildId]
        );

        if (!superBonus) {
          console.warn('⚠️  [MISSION REWARD] Aucun super bonus actif - fallback collectible random');
          const fallback = await db.getRandomCollectible(guildId, mission.theme_id);
          return { type: 'collectible', reward: fallback, name: fallback?.name || 'Collectible' };
        }

        return { type: 'super-bonus', reward: superBonus, name: superBonus.name };
      }

      case 'random-collectible':
      default: {
        // Comportement par défaut: collectible aléatoire
        const collectible = await db.getRandomCollectible(guildId, mission.theme_id);
        return { type: 'collectible', reward: collectible, name: collectible?.name || 'Collectible' };
      }
    }
  }

  /**
   * Donner un super bonus à un joueur (pour récompense mission)
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur dans la DB
   * @param {object} superBonus - Objet super bonus
   * @returns {boolean} Succès
   */
  async giveSuperBonusReward(guildId, playerId, superBonus) {
    try {
      // Calculer l'expiration (24h par défaut, ou selon configuration)
      const duration = superBonus.default_duration || 86400; // 24h en secondes
      const expiresAt = new Date(Date.now() + duration * 1000);

      await db.query(
        `INSERT INTO player_active_bonuses (guild_id, user_id, bonus_id, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id, user_id, bonus_id)
         DO UPDATE SET expires_at = GREATEST(player_active_bonuses.expires_at, $4)`,
        [guildId, playerId, superBonus.id, expiresAt]
      );

      console.log(`✅ [MISSION REWARD] Super bonus '${superBonus.name}' donné au joueur ${playerId}`);
      return true;
    } catch (error) {
      console.error('🔴 [MISSION REWARD] Erreur attribution super bonus:', error);
      return false;
    }
  }

  /**
   * Compléter une mission et donner la récompense configurée
   */
  async completeMission(interaction, mission, player, progress, proof = null) {
    try {
      // Récupérer le branding
      const branding = await db.getGuildBranding(interaction.guildId);

      // Marquer comme complétée
      await db.query(
        `UPDATE mission_progress
         SET status = 'completed', submitted_proof = $1, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [proof, progress.id]
      );

      // 🎁 Récupérer la récompense selon le type configuré (random-collectible, specific-collectible, super-bonus)
      const rewardResult = await this.getMissionReward(interaction.guildId, mission);
      console.log(`🎁 [MISSION] Récompense obtenue: type=${rewardResult.type}, name=${rewardResult.name}`);

      if (!rewardResult.reward) {
        await interaction.followUp({
          content: '✅ Mission terminée mais aucune récompense disponible !'
        });
        return;
      }

      let rewardName = rewardResult.name;

      // ========================================
      // TRAITEMENT SELON LE TYPE DE RÉCOMPENSE
      // ========================================
      if (rewardResult.type === 'super-bonus') {
        // 🌟 SUPER BONUS REWARD
        const superBonus = rewardResult.reward;
        const success = await this.giveSuperBonusReward(interaction.guildId, player.id, superBonus);

        if (success) {
          const duration = superBonus.default_duration || 86400;
          const durationText = duration >= 86400
            ? `${Math.floor(duration / 86400)} jour(s)`
            : `${Math.floor(duration / 3600)} heure(s)`;

          const rewardEmbed = new EmbedBuilder()
            .setTitle('🎉 Mission Réussie !')
            .setDescription(
              `Félicitations ! Tu as terminé la mission **${mission.name}** !\n\n` +
              `**Récompense:** ⭐ Super Bonus **${superBonus.name}**`
            )
            .setColor('#FFD700') // Gold pour super bonus
            .addFields(
              { name: '✨ Effet', value: superBonus.description || 'Bonus spécial', inline: true },
              { name: '⏱️ Durée', value: durationText, inline: true }
            )
            .setFooter(getLoomixFooterWithCustomText('Super Bonus activé !'));

          await interaction.channel.send({ embeds: [rewardEmbed] });
        } else {
          // Fallback si erreur d'attribution
          await interaction.channel.send({
            content: `✅ Mission **${mission.name}** terminée ! (Erreur d'attribution du super bonus)`
          });
        }

      } else {
        // 🎯 COLLECTIBLE REWARD (random ou specific)
        const collectible = rewardResult.reward;

        // Vérifier si le joueur l'a déjà
        const alreadyHas = await db.hasCollectible(interaction.guildId, player.id, collectible.id);

        // Ajouter le collectible si pas de doublon
        if (!alreadyHas) {
          await db.addCollectible(interaction.guildId, player.id, collectible.id, 'mission');
          const playerProgress = await db.incrementProgress(interaction.guildId, player.id, mission.theme_id);

          // Message de récompense
          const rewardEmbed = new EmbedBuilder()
            .setTitle('🎉 Mission Réussie !')
            .setDescription(
              `Félicitations ! Tu as terminé la mission **${mission.name}** !\n\n` +
              `**Récompense:** ${collectible.name}`
            )
            .setColor(branding.secondary_color);

          // Thumbnail uniquement si URL valide (non vide)
          if (collectible.image_url && collectible.image_url.trim()) {
            rewardEmbed.setThumbnail(collectible.image_url);
          }

          rewardEmbed.addFields({
              name: 'Progression',
              value: `${playerProgress.collected_count}/${mission.required_items || 7}`,
              inline: true
            })
            .setFooter(getLoomixFooterWithCustomText(`Rareté: ${collectible.rarity}`));

          await interaction.channel.send({ embeds: [rewardEmbed] });

          // Vérifier si collection complète
          const theme = await db.queryOne('SELECT * FROM themes WHERE id = $1', [mission.theme_id]);
          if (playerProgress.collected_count >= theme.required_items && !playerProgress.is_completed) {
            await this.handleCollectionComplete(interaction, player, theme);
          }

          // 🏅 PROGRESSION ROLES - Vérifier et attribuer rôles intermédiaires
          try {
            const newProgressionRole = await progressionRoleHandler.checkAndAssignProgressionRoles(
              interaction.guild,
              interaction.user.id,
              interaction.guildId,
              mission.theme_id,
              playerProgress.collected_count
            );
            if (newProgressionRole) {
              console.log(`🏅 [PROGRESSION] Nouveau rôle attribué via mission: ${newProgressionRole.name}`);
              await interaction.channel.send({
                content: `🎉 <@${interaction.user.id}> a atteint **${newProgressionRole.percentage}%** de la collection et obtient le rôle **${newProgressionRole.name}** !`
              });
            }
          } catch (error) {
            console.error('🔴 [PROGRESSION] Erreur check progression roles (mission):', error);
          }
        } else {
          // Doublon
          const embed = new EmbedBuilder()
            .setTitle('⚠️ Mission réussie mais doublon !')
            .setDescription(`Tu as terminé la mission mais tu avais déjà **${collectible.name}** dans ta collection !`)
            .setColor(branding.secondary_color)
            .setFooter(await getLoomixFooter(interaction.guildId));

          // Thumbnail uniquement si URL valide (non vide)
          if (collectible.image_url && collectible.image_url.trim()) {
            embed.setThumbnail(collectible.image_url);
          }

          await interaction.channel.send({ embeds: [embed] });
        }

        rewardName = collectible.name;
      }

      // Annonce : mission réussie
      await announcements.announceMissionCompleted(
        interaction.client,
        interaction.guildId,
        interaction.user.username,
        mission.name,
        rewardName
      );

      // 🏆 BADGE TRACKING - Mission Completed
      try {
        await badgeHandler.onMissionCompleted(interaction.guildId, player.id, interaction.client);
        console.log(`🏆 [BADGES] Mission badge tracking appelé pour player ${player.id}`);
      } catch (error) {
        console.error('🔴 [BADGES] Erreur tracking mission:', error);
      }

      // Message immédiat + fermeture après 10 secondes
      await interaction.channel.send('✅ **Mission terminée !** Le thread se ferme dans 10 secondes...');

      setTimeout(async () => {
        try {
          await interaction.channel.setArchived(true);
        } catch (error) {
          console.warn('⚠️  Impossible d\'archiver le thread');
        }
      }, 10000);

    } catch (error) {
      console.error('🔴 Erreur completeMission:', error);
    }
  }

  /**
   * Gérer la collection complète
   */
  async handleCollectionComplete(interaction, player, theme) {
    // Récupérer le branding
    const branding = await db.getGuildBranding(interaction.guildId);

    // Marquer comme complété
    await db.completeCollection(interaction.guildId, player.id, theme.id);

    // Attribuer le rôle final
    if (theme.final_role_discord_id) {
      try {
        const finalRole = interaction.guild.roles.cache.get(theme.final_role_discord_id);

        if (finalRole) {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          await member.roles.add(finalRole);
          console.log(`✅ Rôle "${finalRole.name}" attribué à ${interaction.user.tag}`);
        } else {
          console.error(`❌ Rôle ${theme.final_role_discord_id} introuvable dans le serveur`);
        }
      } catch (error) {
        console.error('❌ Erreur lors de l\'attribution du rôle:', error);
      }
    } else {
      console.log('⚠️  Aucun rôle configuré pour ce thème');
    }

    // Annonce publique
    const announceChannel = interaction.guild.channels.cache.get(process.env.ANNOUNCE_CHANNEL_ID);

    const announceEmbed = new EmbedBuilder()
      .setTitle('👑 COLLECTION COMPLÈTE !')
      .setDescription(
        `**${interaction.user.username}** a complété la collection **${theme.name}** !\n\n` +
        `Félicitations pour avoir collecté les ${theme.required_items} items ! 🎉`
      )
      .setColor(theme.final_role_color || branding.secondary_color)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter(await getLoomixFooter(interaction.guildId))
      .setTimestamp();

    if (announceChannel) {
      await announceChannel.send({ content: `<@${interaction.user.id}>`, embeds: [announceEmbed] });
    }

    // MP au joueur
    try {
      await interaction.user.send({
        embeds: [announceEmbed],
        content: `🎉 Bravo ! Tu as reçu le rôle **${theme.final_role_name}** !`
      });
    } catch (e) {
      // Ignore si MPs fermés
    }
  }

  /**
   * Admin approuve la mission
   */
  async approveMission(interaction) {
    const [, , progressId] = interaction.customId.split('_');

    try {
      const progressData = await db.queryOne(
        `SELECT mp.*, p.discord_id, p.username, m.name as mission_name, m.theme_id, m.reward_type, m.reward_data, t.required_items
         FROM mission_progress mp
         JOIN players p ON mp.player_id = p.id
         JOIN missions m ON mp.mission_id = m.id
         JOIN themes t ON m.theme_id = t.id
         WHERE mp.id = $1`,
        [progressId]
      );

      if (!progressData) {
        return interaction.reply({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      // Marquer comme approuvée
      await db.query(
        `UPDATE mission_progress
         SET status = 'completed', validated_by = $1, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [interaction.user.id, progressId]
      );

      await interaction.update({
        content: `✅ Mission approuvée par ${interaction.user}`,
        components: []
      });

      // 🎁 Récupérer la récompense selon le type configuré (random-collectible, specific-collectible, super-bonus)
      const missionForReward = {
        theme_id: progressData.theme_id,
        reward_type: progressData.reward_type,
        reward_data: progressData.reward_data
      };
      const rewardResult = await this.getMissionReward(progressData.guild_id, missionForReward);
      const player = await db.getPlayerByDiscordId(progressData.guild_id, progressData.discord_id);
      let rewardName = 'Aucune';

      if (rewardResult.reward) {
        rewardName = rewardResult.name;

        if (rewardResult.type === 'super-bonus') {
          // 🌟 SUPER BONUS REWARD
          const superBonus = rewardResult.reward;
          const success = await this.giveSuperBonusReward(progressData.guild_id, player.id, superBonus);

          if (success) {
            const duration = superBonus.default_duration || 86400;
            const durationText = duration >= 86400
              ? `${Math.floor(duration / 86400)} jour(s)`
              : `${Math.floor(duration / 3600)} heure(s)`;

            await interaction.channel.send({
              content: `✅ Mission **${progressData.mission_name}** validée pour <@${progressData.discord_id}> !\n🎁 Récompense : ⭐ Super Bonus **${superBonus.name}** (${durationText})`
            });
          } else {
            await interaction.channel.send({
              content: `✅ Mission **${progressData.mission_name}** validée pour <@${progressData.discord_id}> ! (Erreur d'attribution du super bonus)`
            });
          }

        } else {
          // 🎯 COLLECTIBLE REWARD (random ou specific)
          const collectible = rewardResult.reward;
          const alreadyHas = await db.hasCollectible(interaction.guildId, player.id, collectible.id);

          if (!alreadyHas) {
            await db.addCollectible(interaction.guildId, player.id, collectible.id, 'mission');
            const playerProgress = await db.incrementProgress(interaction.guildId, player.id, progressData.theme_id);

            // 🏅 PROGRESSION ROLES - Vérifier et attribuer rôles intermédiaires (mission approuvée)
            try {
              const newProgressionRole = await progressionRoleHandler.checkAndAssignProgressionRoles(
                interaction.guild,
                progressData.discord_id,  // Le joueur (pas l'admin qui approuve)
                interaction.guildId,
                progressData.theme_id,
                playerProgress.collected_count
              );
              if (newProgressionRole) {
                console.log(`🏅 [PROGRESSION] Nouveau rôle attribué via approbation mission: ${newProgressionRole.name}`);
                await interaction.channel.send({
                  content: `🎉 <@${progressData.discord_id}> a atteint **${newProgressionRole.percentage}%** de la collection et obtient le rôle **${newProgressionRole.name}** !`
                });
              }
            } catch (error) {
              console.error('🔴 [PROGRESSION] Erreur check progression roles (approve):', error);
            }
          }

          await interaction.channel.send({
            content: `✅ Mission **${progressData.mission_name}** validée pour <@${progressData.discord_id}> !\n🎁 Récompense : **${collectible.name}**`
          });
        }
      }

      // Annonce : mission approuvée
      await announcements.announceMissionApproved(
        interaction.client,
        interaction.guildId,
        progressData.username,
        progressData.mission_name,
        interaction.user.username,
        rewardName
      );

      // Notifier le joueur
      try {
        const user = await interaction.client.users.fetch(progressData.discord_id);
        await user.send(`✅ Ta mission **${progressData.mission_name}** a été validée par un administrateur !`);
      } catch (error) {
        console.warn('⚠️  Impossible d\'envoyer MP à', progressData.username);
      }

      // Logger
      await db.logAudit('mission_approved', interaction.user.id, {
        progressId,
        playerId: progressData.player_id,
        playerUsername: progressData.username
      });

      // Archiver le thread après 5 secondes
      setTimeout(async () => {
        try {
          await interaction.channel.setArchived(true);
        } catch (error) {
          console.warn('⚠️  Impossible d\'archiver le thread');
        }
      }, 5000);

    } catch (error) {
      console.error('🔴 Erreur approveMission:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin rejette la mission
   */
  async rejectMission(interaction) {
    const [, , progressId] = interaction.customId.split('_');

    try {
      const progressData = await db.queryOne(
        `SELECT mp.*, p.discord_id, p.username, m.name as mission_name
         FROM mission_progress mp
         JOIN players p ON mp.player_id = p.id
         JOIN missions m ON mp.mission_id = m.id
         WHERE mp.id = $1`,
        [progressId]
      );

      if (!progressData) {
        return interaction.reply({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      // Mettre à jour le statut
      await db.query(
        `UPDATE mission_progress
         SET status = 'rejected', validated_by = $1, updated_at = NOW()
         WHERE id = $2`,
        [interaction.user.id, progressId]
      );

      await interaction.update({
        content: `❌ Mission refusée par ${interaction.user}`,
        components: []
      });

      // Annonce : mission refusée
      await announcements.announceMissionRejected(
        interaction.client,
        interaction.guildId,
        progressData.username,
        progressData.mission_name,
        interaction.user.username
      );

      // Notifier le joueur
      try {
        const user = await interaction.client.users.fetch(progressData.discord_id);
        await user.send(`❌ Ta mission **${progressData.mission_name}** a été refusée. Vérifie les consignes et réessaye !`);
      } catch (error) {
        console.warn('⚠️  Impossible d\'envoyer MP à', progressData.username);
      }

      // Logger
      await db.logAudit('mission_rejected', interaction.user.id, {
        progressId,
        playerId: progressData.player_id,
        playerUsername: progressData.username
      });

    } catch (error) {
      console.error('🔴 Erreur rejectMission:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin clique sur "Gérer les Questions" (Quiz mission)
   */
  async handleQuizQuestionsManagement(interaction, page = 0) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      if (!mission || mission.type !== 'quiz') {
        return interaction.reply({
          content: '❌ Cette mission n\'est pas un quiz.',
          flags: 64
        });
      }

      // Récupérer toutes les questions de cette mission spécifique
      const questions = await db.getQuizQuestionsByMission(interaction.guildId, mission.id);

      // Pagination (20 questions par page pour rester sous la limite de 25 fields)
      const questionsPerPage = 20;
      const totalPages = Math.ceil(questions.length / questionsPerPage) || 1;
      const currentPage = Math.min(Math.max(0, page), totalPages - 1);
      const startIndex = currentPage * questionsPerPage;
      const endIndex = startIndex + questionsPerPage;
      const paginatedQuestions = questions.slice(startIndex, endIndex);

      const embed = new EmbedBuilder()
        .setTitle(`📝 Questions du Quiz - ${mission.name}`)
        .setDescription(questions.length === 0
          ? '**Aucune question n\'a encore été créée.**\n\nCliquez sur "Ajouter une Question" pour commencer.'
          : `**${questions.length} question(s) enregistrée(s)** (Page ${currentPage + 1}/${totalPages})`)
        .setColor(branding.secondary_color);

      if (paginatedQuestions.length > 0) {
        paginatedQuestions.forEach((q, i) => {
          const wrongAnswersText = q.wrong_answers && q.wrong_answers.length > 0
            ? `\n❌ Mauvaises réponses: ${q.wrong_answers.join(', ')}`
            : '';

          embed.addFields({
            name: `${startIndex + i + 1}. ${q.question_text}`,
            value: `✅ Réponse: **${q.correct_answer}**${wrongAnswersText}\n💡 Difficulté: ${q.difficulty}${q.hint ? `\n💭 Indice: ${q.hint}` : ''}`,
            inline: false
          });
        });
      }

      embed.setFooter(await getLoomixFooter(interaction.guildId));

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_quiz_add_${missionId}`)
          .setLabel('➕ Ajouter une Question')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`mission_quiz_questions_${missionId}:${currentPage}`)
          .setLabel('🔄 Rafraîchir')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`select_mission_${missionId}`)
          .setLabel('↩️ Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      const components = [row1];

      // Ajouter select menu pour supprimer (seulement questions de la page actuelle)
      if (paginatedQuestions.length > 0) {
        const deleteMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_quiz_delete_${missionId}`)
          .setPlaceholder('🗑️ Supprimer une question de cette page')
          .addOptions(
            paginatedQuestions.map((q, index) => ({
              label: `Q${startIndex + index + 1}: ${q.question_text.substring(0, 80)}${q.question_text.length > 80 ? '...' : ''}`,
              value: q.id.toString(),
              description: `Réponse: ${q.correct_answer.substring(0, 50)}`
            }))
          );

        components.push(new ActionRowBuilder().addComponents(deleteMenu));
      }

      // Ajouter boutons de pagination si nécessaire
      if (totalPages > 1) {
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_quiz_page_${missionId}:${Math.max(0, currentPage - 1)}`)
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId(`mission_quiz_page_${missionId}:${Math.min(totalPages - 1, currentPage + 1)}`)
            .setLabel('Suivant ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
        );
        components.push(row2);
      }

      await interaction.update({
        embeds: [embed],
        components
      });

    } catch (error) {
      console.error('🔴 Erreur handleQuizQuestionsManagement:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin clique sur "Modifier le Mot-Clé" (Keyword mission)
   */
  async handleKeywordEdit(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Déférer l'interaction si pas encore répondue
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate();
      }

      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      if (!mission || mission.type !== 'keyword-message') {
        return interaction.reply({
          content: '❌ Cette mission n\'est pas une mission "Mot Deviné".',
          flags: 64
        });
      }

      // Récupérer tous les mots-clés de cette mission
      const keywords = await db.getMissionKeywords(interaction.guildId, missionId);

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setTitle(`🔤 Mots-Clés - ${mission.name}`)
        .setDescription(keywords.length === 0
          ? '**Aucun mot-clé n\'a encore été défini.**\n\nCliquez sur "Ajouter un Mot-Clé" pour commencer.\n\n💡 **Conseil:** Ajoutez plusieurs mots-clés différents pour éviter la répétition et rendre les missions plus variées !'
          : `**${keywords.length} mot(s)-clé(s) enregistré(s)**\n\nLes joueurs devront faire dire **un de ces mots** à un autre joueur.`)
        .setColor(branding.secondary_color);

      if (keywords.length > 0) {
        const difficultyEmojis = {
          'easy': '🟢',
          'medium': '🟡',
          'hard': '🔴'
        };

        const keywordsList = keywords.map((kw, i) => {
          const difficultyIcon = difficultyEmojis[kw.difficulty] || '🟡';
          return `${i + 1}. ${difficultyIcon} **${kw.keyword}** ${kw.target_channel_id ? `(Canal: <#${kw.target_channel_id}>)` : '(Tous les canaux)'}`;
        }).join('\n');

        embed.addFields({
          name: '📝 Liste des mots-clés',
          value: keywordsList,
          inline: false
        });
      }

      embed.setFooter(await getLoomixFooter(interaction.guildId));

      // Créer les boutons
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_keyword_add_${missionId}`)
          .setLabel('➕ Ajouter un Mot-Clé')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`mission_keyword_delete_${missionId}`)
          .setLabel('🗑️ Supprimer un Mot-Clé')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(keywords.length === 0),
        new ButtonBuilder()
          .setCustomId(`mission_keyword_edit_${missionId}`)
          .setLabel('🔄 Rafraîchir')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`select_mission_${missionId}`)
          .setLabel('↩️ Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });

    } catch (error) {
      console.error('🔴 Erreur handleKeywordEdit:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Afficher le sous-menu pour ajouter un mot-clé avec tuto
   */
  async handleKeywordAddMenu(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      await interaction.deferUpdate();

      // Récupérer le branding
      const branding = await db.getGuildBranding(interaction.guildId);

      // Créer l'embed avec les instructions
      const embed = new EmbedBuilder()
        .setTitle('📝 Ajouter un Mot-Clé')
        .setDescription(
          '**Instructions:**\n\n' +
          '1️⃣ Choisis la **difficulté** du mot-clé dans le menu ci-dessous\n' +
          '2️⃣ Un formulaire s\'ouvrira pour saisir:\n' +
          '   • Le mot-clé (ex: pomme, dragon, soleil)\n' +
          '   • Le canal ciblé (optionnel)\n\n' +
          '**Niveaux de difficulté:**\n' +
          '🟢 **Facile** - Mots simples et courants (ex: bonjour, chat, bleu)\n' +
          '🟡 **Moyen** - Mots standard (ex: aventure, mystère, galaxie)\n' +
          '🔴 **Difficile** - Mots rares ou complexes (ex: épiphanie, ubiquité)\n\n' +
          '💡 Le mot-clé sera automatiquement en minuscule.'
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      // Menu de sélection de difficulté
      const difficultySelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`difficulty_select_${missionId}`)
          .setPlaceholder('🎯 Choisir la difficulté du mot-clé')
          .addOptions([
            {
              label: 'Facile',
              description: 'Mot simple et courant',
              value: 'easy',
              emoji: '🟢'
            },
            {
              label: 'Moyen',
              description: 'Difficulté standard',
              value: 'medium',
              emoji: '🟡'
            },
            {
              label: 'Difficile',
              description: 'Mot rare ou complexe',
              value: 'hard',
              emoji: '🔴'
            }
          ])
      );

      // Bouton retour
      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_keyword_back_${missionId}`)
          .setLabel('↩️ Retour à la liste')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [difficultySelect, backButton]
      });

    } catch (error) {
      console.error('🔴 Erreur handleKeywordAddMenu:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin sélectionne une difficulté via le menu déroulant
   */
  async handleDifficultySelect(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[2]);
    const difficulty = interaction.values[0]; // easy, medium ou hard

    try {
      // Emoji selon la difficulté
      const difficultyEmojis = { 'easy': '🟢', 'medium': '🟡', 'hard': '🔴' };
      const difficultyLabels = { 'easy': 'Facile', 'medium': 'Moyen', 'hard': 'Difficile' };

      // Afficher un modal pour saisir le mot-clé (la difficulté est dans le customId)
      const modal = new ModalBuilder()
        .setCustomId(`modal_keyword_add_${missionId}_${difficulty}`)
        .setTitle(`${difficultyEmojis[difficulty]} Ajouter un Mot-Clé (${difficultyLabels[difficulty]})`);

      const keywordInput = new TextInputBuilder()
        .setCustomId('keyword')
        .setLabel('Mot-Clé')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: pomme, soleil, dragon...')
        .setRequired(true)
        .setMaxLength(50);

      const channelInput = new TextInputBuilder()
        .setCustomId('channel_id')
        .setLabel('ID du Canal (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Laissez vide pour tous les canaux')
        .setRequired(false);

      const row1 = new ActionRowBuilder().addComponents(keywordInput);
      const row2 = new ActionRowBuilder().addComponents(channelInput);

      modal.addComponents(row1, row2);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('🔴 Erreur handleDifficultySelect:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin clique sur "Supprimer un Mot-Clé"
   */
  async handleKeywordDelete(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Récupérer tous les mots-clés de cette mission
      const keywords = await db.getMissionKeywords(interaction.guildId, missionId);

      if (keywords.length === 0) {
        return interaction.reply({
          content: '❌ Aucun mot-clé à supprimer.',
          flags: 64
        });
      }

      // Limiter à 25 options (limite Discord pour les select menus)
      const limitedKeywords = keywords.slice(0, 25);
      const hasMore = keywords.length > 25;

      // Créer un select menu avec les mots-clés (max 25)
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_keyword_delete_${missionId}`)
        .setPlaceholder('Choisir un mot-clé à supprimer')
        .addOptions(
          limitedKeywords.map(kw => ({
            // Tronquer le label à 100 caractères max (limite Discord)
            label: kw.keyword.length > 100 ? kw.keyword.substring(0, 97) + '...' : kw.keyword,
            value: kw.id.toString(),
            description: kw.target_channel_id ? `Canal: ${kw.target_channel_id}` : 'Tous les canaux'
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      let content = '🗑️ **Sélectionne le mot-clé à supprimer:**';
      if (hasMore) {
        content += `\n\n⚠️ *Seuls les 25 premiers mots-clés sont affichés (${keywords.length} au total). Utilisez l'Admin Panel pour gérer tous les mots-clés.*`;
      }

      await interaction.reply({
        content,
        components: [row],
        flags: 64
      });

    } catch (error) {
      console.error('🔴 Erreur handleKeywordDelete:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin confirme la suppression d'un mot-clé via select menu
   */
  async handleKeywordDeleteConfirm(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);
    const keywordId = parseInt(interaction.values[0]);

    try {
      // Supprimer le mot-clé
      await db.deleteMissionKeyword(interaction.guildId, keywordId);

      await interaction.update({
        content: '✅ **Mot-clé supprimé avec succès !**\n\n_Retour automatique..._',
        components: []
      });

      // Retourner automatiquement à la liste des mots-clés après 1.5 secondes
      // Note: try-catch silencieux car l'interaction peut être expirée
      setTimeout(async () => {
        try {
          await interaction.editReply({
            content: null,
            embeds: [],
            components: []
          });
          // Forcer le rafraîchissement via editReply plutôt qu'un faux handleKeywordEdit
          await this.handleKeywordEdit({
            ...interaction,
            customId: `mission_keyword_edit_${missionId}`,
            replied: true,
            deferred: true
          });
        } catch (err) {
          // Silencieux - l'interaction peut avoir expiré, ce n'est pas grave
          console.log('ℹ️ Auto-refresh ignoré (interaction expirée)');
        }
      }, 1500);

    } catch (error) {
      console.error('🔴 Erreur handleKeywordDeleteConfirm:', error);
      await interaction.update({
        content: '❌ Une erreur est survenue lors de la suppression.',
        components: []
      });
    }
  }

  /**
   * Admin clique sur "Ajouter une Question" (Quiz mission)
   * Étape 1: Afficher le sélecteur de difficulté
   */
  async handleQuizAdd(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      await interaction.deferUpdate();

      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      if (!mission || mission.type !== 'quiz') {
        return interaction.editReply({
          content: '❌ Cette mission n\'est pas une mission de type Quiz.',
          components: []
        });
      }

      // Créer l'embed avec les instructions
      const embed = new EmbedBuilder()
        .setTitle('❓ Ajouter une Question de Quiz')
        .setDescription(
          '**Instructions:**\n\n' +
          '1️⃣ Choisis la **difficulté** de la question dans le menu ci-dessous\n' +
          '2️⃣ Un formulaire s\'ouvrira pour saisir:\n' +
          '   • La question (ex: Combien y a-t-il de nains ?)\n' +
          '   • La réponse correcte (ex: 7)\n' +
          '   • Un indice optionnel\n\n' +
          '**Niveaux de difficulté:**\n' +
          '🟢 **Facile** - Questions simples (ex: couleurs, nombres)\n' +
          '🟡 **Moyen** - Questions standard (ex: culture générale)\n' +
          '🔴 **Difficile** - Questions complexes (ex: dates précises, détails)\n\n' +
          '💡 Le joueur pourra essayer plusieurs fois dans le temps imparti.'
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      // Menu de sélection de difficulté
      const difficultySelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`quiz_difficulty_select_${missionId}`)
          .setPlaceholder('🎯 Choisir la difficulté de la question')
          .addOptions([
            {
              label: 'Facile',
              description: 'Question simple',
              value: 'easy',
              emoji: '🟢'
            },
            {
              label: 'Moyen',
              description: 'Difficulté standard',
              value: 'medium',
              emoji: '🟡'
            },
            {
              label: 'Difficile',
              description: 'Question complexe',
              value: 'hard',
              emoji: '🔴'
            }
          ])
      );

      // Bouton retour
      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_quiz_questions_${missionId}`)
          .setLabel('↩️ Retour à la liste')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [difficultySelect, backButton]
      });

    } catch (error) {
      console.error('🔴 Erreur handleQuizAdd:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin sélectionne une difficulté pour une question de quiz
   * Étape 2: Ouvrir le modal avec la difficulté pré-sélectionnée
   */
  async handleQuizDifficultySelect(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);
    const difficulty = interaction.values[0]; // easy, medium ou hard

    try {
      // Emoji selon la difficulté
      const difficultyEmojis = { 'easy': '🟢', 'medium': '🟡', 'hard': '🔴' };
      const difficultyLabels = { 'easy': 'Facile', 'medium': 'Moyen', 'hard': 'Difficile' };

      // Afficher un modal pour saisir la question (la difficulté est dans le customId)
      const modal = new ModalBuilder()
        .setCustomId(`modal_quiz_add_${missionId}_${difficulty}`)
        .setTitle(`${difficultyEmojis[difficulty]} Question de Quiz (${difficultyLabels[difficulty]})`);

      const questionInput = new TextInputBuilder()
        .setCustomId('question')
        .setLabel('Question')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ex: Combien y a-t-il de nains dans Blanche-Neige ?')
        .setRequired(true)
        .setMaxLength(500);

      const correctAnswerInput = new TextInputBuilder()
        .setCustomId('correct_answer')
        .setLabel('Réponse Correcte')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 7')
        .setRequired(true)
        .setMaxLength(200);

      const hintInput = new TextInputBuilder()
        .setCustomId('hint')
        .setLabel('Indice (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Ils vivent avec Blanche-Neige')
        .setRequired(false)
        .setMaxLength(200);

      const row1 = new ActionRowBuilder().addComponents(questionInput);
      const row2 = new ActionRowBuilder().addComponents(correctAnswerInput);
      const row3 = new ActionRowBuilder().addComponents(hintInput);

      modal.addComponents(row1, row2, row3);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('🔴 Erreur handleQuizDifficultySelect:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin clique sur "🎯 Nombre d'essais" pour configurer max_attempts
   */
  async handleMaxAttemptsConfig(interaction) {
    try {
      await interaction.deferUpdate();

      // Extraire missionId depuis le customId: mission_max_attempts_config_{missionId}
      const missionId = parseInt(interaction.customId.split('_')[4]);

      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      if (!mission) {
        return interaction.editReply({
          content: '❌ Mission introuvable.',
          components: []
        });
      }

      // Créer l'embed
      const currentValue = mission.max_attempts === null ? 'Illimité' : `${mission.max_attempts} essai(s)`;

      const embed = new EmbedBuilder()
        .setTitle('🎯 Configurer le Nombre d\'Essais')
        .setDescription(
          `**Mission:** ${mission.name}\n\n` +
          `**Valeur actuelle:** ${currentValue}\n\n` +
          '📝 Choisis le nombre maximum d\'essais que le joueur aura pour cette mission quiz.\n\n' +
          '• **Illimité**: Le joueur peut essayer autant de fois qu\'il veut (limité par le timeout)\n' +
          '• **1-10**: Nombre d\'essais fixes avant échec automatique'
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      // Créer le select menu
      const options = [
        { label: '♾️ Illimité', description: 'Essais illimités (limité par timeout)', value: 'unlimited' }
      ];

      // Ajouter les options 1-10
      for (let i = 1; i <= 10; i++) {
        options.push({
          label: `${i} essai${i > 1 ? 's' : ''}`,
          description: `Maximum ${i} tentative${i > 1 ? 's' : ''}`,
          value: i.toString()
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mission_max_attempts_select_${missionId}`)
        .setPlaceholder('🎯 Choisir le nombre d\'essais')
        .addOptions(options);

      const row1 = new ActionRowBuilder().addComponents(selectMenu);

      // Bouton retour
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`select_mission_${missionId}`)
          .setLabel('← Retour à la mission')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row1, row2]
      });

    } catch (error) {
      console.error('🔴 Erreur handleMaxAttemptsConfig:', error);
      await interaction.editReply({
        content: '❌ Une erreur est survenue.',
        components: []
      });
    }
  }

  /**
   * Admin sélectionne un nombre d'essais dans le select menu
   */
  async handleMaxAttemptsSelect(interaction) {
    try {
      await interaction.deferUpdate();

      const missionId = parseInt(interaction.customId.split('_')[4]);
      const selectedValue = interaction.values[0]; // 'unlimited' ou '1'-'10'

      // Récupérer le branding
      const branding = await db.getGuildBranding(interaction.guildId);

      // Déterminer la valeur à enregistrer
      let maxAttempts = null; // Par défaut illimité
      if (selectedValue !== 'unlimited') {
        maxAttempts = parseInt(selectedValue);
      }

      // Mettre à jour la base de données
      await db.query(
        `UPDATE missions SET max_attempts = $1 WHERE id = $2 AND guild_id = $3`,
        [maxAttempts, missionId, interaction.guildId]
      );

      // Message de confirmation
      const displayValue = maxAttempts === null ? 'illimité' : `${maxAttempts} essai(s)`;

      const embed = new EmbedBuilder()
        .setTitle('✅ Nombre d\'essais mis à jour')
        .setDescription(
          `Le nombre maximum d'essais a été configuré à **${displayValue}**.\n\n` +
          '💡 Cette configuration s\'appliquera à toutes les futures tentatives de quiz pour cette mission.'
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      // Bouton retour à la mission
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`select_mission_${missionId}`)
          .setLabel('← Retour à la mission')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

      console.log(`✅ Mission ${missionId}: max_attempts configuré à ${maxAttempts}`);

    } catch (error) {
      console.error('🔴 Erreur handleMaxAttemptsSelect:', error);
      await interaction.editReply({
        content: '❌ Une erreur est survenue lors de la mise à jour.',
        components: []
      });
    }
  }

  /**
   * Admin clique sur "Supprimer une Question" (Quiz mission)
   */
  async handleQuizDelete(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Récupérer la mission pour obtenir le theme_id
      const mission = await db.getMissionById(interaction.guildId, missionId);

      if (!mission || mission.type !== 'quiz') {
        return interaction.reply({
          content: '❌ Cette mission n\'est pas une mission de type Quiz.',
          flags: 64
        });
      }

      // Récupérer toutes les questions de cette mission spécifique
      const questions = await db.getQuizQuestionsByMission(interaction.guildId, mission.id);

      if (questions.length === 0) {
        return interaction.reply({
          content: '❌ Aucune question à supprimer.',
          flags: 64
        });
      }

      // Limiter à 25 questions (limite Discord pour select menu)
      const questionsToShow = questions.slice(0, 25);
      const hasMore = questions.length > 25;

      // Créer un select menu avec les questions (max 25)
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_quiz_delete_${missionId}`)
        .setPlaceholder('Choisir une question à supprimer')
        .addOptions(
          questionsToShow.map((q, index) => ({
            label: `Q${index + 1}: ${q.question_text.substring(0, 80)}${q.question_text.length > 80 ? '...' : ''}`,
            value: q.id.toString(),
            description: `Réponse: ${q.correct_answer.substring(0, 50)}`
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      let content = '🗑️ **Sélectionne la question à supprimer:**';
      if (hasMore) {
        content += `\n⚠️ Affichage limité aux 25 premières questions (total: ${questions.length})\n💡 Supprime des questions pour voir les suivantes.`;
      }

      await interaction.reply({
        content,
        components: [row],
        flags: 64
      });

    } catch (error) {
      console.error('🔴 Erreur handleQuizDelete:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin confirme la suppression d'une question via select menu
   */
  async handleQuizDeleteConfirm(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);
    const questionId = parseInt(interaction.values[0]);

    try {
      // Déférer l'interaction avant les requêtes DB
      await interaction.deferUpdate();

      // Supprimer la question
      await db.deleteQuizQuestion(interaction.guildId, questionId);

      // Logger l'action
      await audit.logMissionQuizQuestionDeleted(
        interaction.guildId,
        interaction.user.id,
        missionId,
        questionId
      );

      // Bouton retour vers la mission
      const backButton = new ButtonBuilder()
        .setCustomId(`select_mission_${missionId}`)
        .setLabel('🔙 Retour à la mission')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(backButton);

      await interaction.editReply({
        content: '✅ **Question supprimée avec succès !**',
        components: [row]
      });

    } catch (error) {
      console.error('🔴 Erreur handleQuizDeleteConfirm:', error);

      const errorMsg = {
        content: '❌ Une erreur est survenue lors de la suppression.',
        components: []
      };

      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.update(errorMsg);
      }
    }
  }

  /**
   * Admin clique sur "Modifier" (Edit mission parameters)
   */
  async handleMissionEdit(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[2]);

    try {
      // Récupérer la mission
      const mission = await db.getMissionById(interaction.guildId, missionId);

      if (!mission) {
        return interaction.reply({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      // TODO: Implémenter l'interface de modification complète
      // Pour l'instant, affichons un message temporaire
      await interaction.reply({
        content: `🚧 Interface de modification en cours de développement.\n\n**Mission:** ${mission.name}\n**Type:** ${mission.type}\n**Timeout:** ${mission.timeout}s\n\nCette fonctionnalité permettra de modifier tous les paramètres de la mission.`,
        flags: 64
      });

    } catch (error) {
      console.error('🔴 Erreur handleMissionEdit:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin clique sur "Configurer les Canaux" (Channel configuration)
   */
  async handleChannelConfiguration(interaction) {
    await interaction.deferUpdate();
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      if (!mission || mission.type !== 'keyword-message') {
        return interaction.followUp({
          content: '❌ Cette mission n\'est pas une mission de type "keyword-message".',
          flags: 64
        });
      }

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setTitle(`📡 Configuration des Canaux - ${mission.name}`)
        .setDescription(
          'Sélectionne les canaux dans lesquels les missions peuvent être assignées.\n\n' +
          '**Note:** Si aucun canal n\'est sélectionné, tous les canaux texte seront disponibles.'
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      // Afficher les canaux actuellement configurés
      if (mission.allowed_channels && mission.allowed_channels.length > 0) {
        const channelsList = mission.allowed_channels
          .map(id => `<#${id}>`)
          .join(', ');
        embed.addFields({
          name: '📍 Canaux actuels',
          value: channelsList || 'Aucun canal configuré',
          inline: false
        });
      } else {
        embed.addFields({
          name: '📍 Canaux actuels',
          value: '🌐 Tous les canaux (par défaut)',
          inline: false
        });
      }

      // Créer le ChannelSelectMenu
      const { ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`mission_channels_select_${missionId}`)
        .setPlaceholder('Sélectionne les canaux autorisés')
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(0)
        .setMaxValues(25); // Discord limite à 25 sélections

      // Boutons
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_channels_reset_${missionId}`)
          .setLabel('🔄 Réinitialiser (Tous les canaux)')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`select_mission_${missionId}`)
          .setLabel('↩️ Retour')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(channelSelect),
          buttons
        ]
      });

    } catch (error) {
      console.error('🔴 Erreur handleChannelConfiguration:', error);
      await interaction.followUp({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin sélectionne les canaux
   */
  async handleChannelSelect(interaction) {
    await interaction.deferUpdate();
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Récupérer le branding
      const branding = await db.getGuildBranding(interaction.guildId);

      const selectedChannels = interaction.values; // IDs des canaux sélectionnés

      // Mettre à jour la base de données
      await db.updateMissionAllowedChannels(interaction.guildId, missionId, selectedChannels);

      // Message de confirmation
      const channelsList = selectedChannels.length > 0
        ? selectedChannels.map(id => `<#${id}>`).join(', ')
        : '🌐 Tous les canaux';

      const embed = new EmbedBuilder()
        .setTitle('✅ Configuration des Canaux Mise à Jour')
        .setDescription(
          `Les canaux autorisés pour cette mission ont été configurés avec succès !\n\n` +
          `**Canaux sélectionnés:**\n${channelsList}`
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`select_mission_${missionId}`)
          .setLabel('↩️ Retour à la mission')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [button]
      });

    } catch (error) {
      console.error('🔴 Erreur handleChannelSelect:', error);
      await interaction.followUp({
        content: '❌ Une erreur est survenue lors de la sauvegarde.',
        flags: 64
      });
    }
  }

  /**
   * Admin réinitialise les canaux (tous les canaux)
   */
  async handleChannelReset(interaction) {
    await interaction.deferUpdate();
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Récupérer le branding
      const branding = await db.getGuildBranding(interaction.guildId);

      // Mettre à jour la base de données (null = tous les canaux)
      await db.updateMissionAllowedChannels(interaction.guildId, missionId, null);

      const embed = new EmbedBuilder()
        .setTitle('✅ Configuration Réinitialisée')
        .setDescription(
          `Les restrictions de canaux ont été supprimées.\n\n` +
          `La mission peut maintenant être assignée dans **tous les canaux texte**.`
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`select_mission_${missionId}`)
          .setLabel('↩️ Retour à la mission')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [button]
      });

    } catch (error) {
      console.error('🔴 Erreur handleChannelReset:', error);
      await interaction.followUp({
        content: '❌ Une erreur est survenue lors de la réinitialisation.',
        flags: 64
      });
    }
  }

  /**
   * Vérifier et gérer les missions expirées (appelé périodiquement)
   * @param {Client} client - Client Discord
   */
  async checkExpiredMissions(client) {
    try {
      // Récupérer toutes les missions en cours qui ont expiré
      const expiredMissions = await db.queryAll(`
        SELECT mp.*, m.name as mission_name, p.discord_id, p.username
        FROM mission_progress mp
        JOIN missions m ON mp.mission_id = m.id
        JOIN players p ON mp.player_id = p.id
        WHERE mp.status = 'in_progress'
          AND mp.expires_at IS NOT NULL
          AND mp.expires_at < NOW()
      `);

      if (expiredMissions.length === 0) {
        return; // Aucune mission expirée
      }

      console.log(`⏰ ${expiredMissions.length} mission(s) expirée(s) détectée(s)`);

      for (const mission of expiredMissions) {
        try {
          // Marquer la mission comme échouée
          await db.query(`
            UPDATE mission_progress
            SET status = 'failed', updated_at = NOW()
            WHERE id = $1
          `, [mission.id]);

          // Envoyer un message dans le thread si disponible
          if (mission.thread_id) {
            console.log(`🔍 [DEBUG TIMEOUT] Tentative d'envoi du message dans le thread ${mission.thread_id}`);
            const thread = await client.channels.fetch(mission.thread_id).catch((err) => {
              console.error(`🔴 [DEBUG TIMEOUT] Impossible de récupérer le thread ${mission.thread_id}:`, err.message);
              return null;
            });

            if (thread) {
              console.log(`✅ [DEBUG TIMEOUT] Thread récupéré: ${thread.name}, archived: ${thread.archived}`);
              try {
                await thread.send('⏰ **Temps écoulé !** Tu n\'as pas complété la mission à temps. Le thread se ferme dans 10 secondes...');
                console.log(`✅ [DEBUG TIMEOUT] Message envoyé dans le thread`);
              } catch (error) {
                console.error(`🔴 [DEBUG TIMEOUT] Impossible d'envoyer le message:`, error.message);
              }

              // Fermer le thread après 10 secondes
              setTimeout(async () => {
                try {
                  await thread.setArchived(true);
                  console.log(`✅ [DEBUG TIMEOUT] Thread archivé`);
                } catch (error) {
                  console.warn('⚠️  Impossible d\'archiver le thread:', error.message);
                }
              }, 10000);
            } else {
              console.warn(`⚠️  [DEBUG TIMEOUT] Thread ${mission.thread_id} introuvable ou inaccessible`);
            }
          } else {
            console.warn(`⚠️  [DEBUG TIMEOUT] Pas de thread_id pour la mission ${mission.id}`);
          }

          // Annonce : mission échouée
          await announcements.announceMissionFailed(
            client,
            mission.guild_id,
            mission.username,
            mission.mission_name,
            'Temps écoulé'
          );

          console.log(`✅ Mission expirée traitée: ${mission.mission_name} pour ${mission.username}`);

        } catch (error) {
          console.error(`🔴 Erreur traitement mission expirée ${mission.id}:`, error);
        }
      }

    } catch (error) {
      console.error('🔴 Erreur checkExpiredMissions:', error);
    }
  }

  /**
   * Récupérer les missions "bloquées" au démarrage du bot
   * (missions créées avant un restart, avec bouton inactif)
   * @param {Client} client - Client Discord
   */
  async recoverStaleMissions(client) {
    try {
      console.log('🔍 Recherche de missions bloquées...');

      // Trouver les missions in_progress sans expires_at (bouton jamais cliqué ou inactif)
      const staleMissions = await db.queryAll(`
        SELECT mp.*, m.name as mission_name, m.timeout, p.discord_id, p.username
        FROM mission_progress mp
        JOIN missions m ON mp.mission_id = m.id
        JOIN players p ON mp.player_id = p.id
        WHERE mp.status = 'in_progress'
          AND mp.expires_at IS NULL
          AND mp.thread_id IS NOT NULL
      `);

      if (staleMissions.length === 0) {
        console.log('✅ Aucune mission bloquée détectée');
        return;
      }

      console.log(`🔄 ${staleMissions.length} mission(s) bloquée(s) détectée(s) - Envoi de nouveaux boutons`);

      for (const mission of staleMissions) {
        try {
          // Récupérer le thread
          const thread = await client.channels.fetch(mission.thread_id).catch(() => null);

          if (!thread) {
            console.warn(`⚠️  Thread ${mission.thread_id} introuvable pour mission ${mission.id}`);
            continue;
          }

          // Récupérer le branding
          const branding = await db.getGuildBranding(mission.guild_id);

          // Convertir le timeout pour l'affichage
          const timeoutSeconds = mission.timeout || 300;
          const timeoutDisplay = timeoutSeconds >= 60 && timeoutSeconds % 60 === 0
            ? `${timeoutSeconds / 60} minute${timeoutSeconds / 60 > 1 ? 's' : ''}`
            : `${timeoutSeconds} seconde${timeoutSeconds > 1 ? 's' : ''}`;

          // Envoyer un nouveau message avec bouton fonctionnel
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

          const embed = new EmbedBuilder()
            .setTitle('🔄 Mission Récupérée')
            .setDescription(
              `Le bot a redémarré et ton bouton précédent ne fonctionne plus.\n\n` +
              `Clique sur le nouveau bouton ci-dessous pour lancer ta mission !\n\n` +
              `⏰ Tu auras **${timeoutDisplay}** pour l'accomplir.`
            )
            .setColor(branding.secondary_color)
            .setFooter(await getLoomixFooter(mission.guild_id));

          const button = new ButtonBuilder()
            .setCustomId(`mission_start_${mission.mission_id}_${mission.discord_id}`)
            .setLabel('🎯 Lancer la mission')
            .setStyle(ButtonStyle.Primary);

          const row = new ActionRowBuilder().addComponents(button);

          await thread.send({ embeds: [embed], components: [row] });
          console.log(`✅ Nouveau bouton envoyé pour mission ${mission.id} (${mission.mission_name} - ${mission.username})`);

        } catch (error) {
          console.error(`🔴 Erreur récupération mission ${mission.id}:`, error);
        }
      }

    } catch (error) {
      console.error('🔴 Erreur recoverStaleMissions:', error);
    }
  }

  /**
   * Handler pour afficher l'interface de configuration de récompense d'une mission
   * Bouton: mission_reward_config_{missionId}
   */
  async handleRewardConfig(interaction) {
    try {
      await interaction.deferUpdate();
      const guildId = interaction.guildId;

      // Extraire missionId depuis le customId: mission_reward_config_{missionId}
      const parts = interaction.customId.split('_');
      const missionId = parseInt(parts[3]);

      // Récupérer la mission
      const mission = await db.getMissionById(guildId, missionId);
      if (!mission) {
        return interaction.editReply({
          content: '❌ Mission introuvable.',
          embeds: [],
          components: []
        });
      }

      // Déterminer le type de récompense actuel
      const currentRewardType = mission.reward_type || 'random-collectible';
      let currentRewardLabel = '🎲 Collectible aléatoire';
      let currentRewardDetails = 'Le joueur recevra un collectible au hasard selon les probabilités de rareté.';

      if (currentRewardType === 'specific-collectible' && mission.reward_data) {
        const rewardData = typeof mission.reward_data === 'string'
          ? JSON.parse(mission.reward_data)
          : mission.reward_data;
        if (rewardData.collectible_id) {
          const collectible = await db.queryOne(
            'SELECT name, rarity FROM collectibles WHERE id = $1 AND guild_id = $2',
            [rewardData.collectible_id, guildId]
          );
          if (collectible) {
            currentRewardLabel = `🎯 ${collectible.name} (${collectible.rarity})`;
            currentRewardDetails = `Le joueur recevra exactement ce collectible.`;
          }
        }
      } else if (currentRewardType === 'super-bonus') {
        currentRewardLabel = '⭐ Super Bonus';
        currentRewardDetails = 'Le joueur recevra un super bonus aléatoire.';
      }

      const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      const embed = new EmbedBuilder()
        .setTitle('🎁 Configuration de la Récompense')
        .setDescription(
          `**Mission:** ${mission.name}\n` +
          `**Type:** ${mission.type}\n\n` +
          `**Récompense actuelle:** ${currentRewardLabel}\n` +
          `*${currentRewardDetails}*\n\n` +
          `Sélectionnez le type de récompense pour cette mission:`
        )
        .setColor('#10b981');

      // Menu de sélection du type de récompense
      const rewardTypeMenu = new StringSelectMenuBuilder()
        .setCustomId(`mission_reward_type_${missionId}`)
        .setPlaceholder('Choisir le type de récompense')
        .addOptions([
          {
            label: 'Collectible aléatoire',
            description: 'Un collectible au hasard selon les probabilités de rareté',
            value: 'random-collectible',
            emoji: '🎲',
            default: currentRewardType === 'random-collectible'
          },
          {
            label: 'Collectible spécifique',
            description: 'Un collectible précis défini par l\'admin',
            value: 'specific-collectible',
            emoji: '🎯',
            default: currentRewardType === 'specific-collectible'
          },
          {
            label: 'Super Bonus',
            description: 'Un super bonus aléatoire',
            value: 'super-bonus',
            emoji: '⭐',
            default: currentRewardType === 'super-bonus'
          }
        ]);

      const selectRow = new ActionRowBuilder().addComponents(rewardTypeMenu);

      // Bouton retour
      const backButton = new ButtonBuilder()
        .setCustomId(`select_mission_${missionId}`)
        .setLabel('↩️ Retour à la mission')
        .setStyle(ButtonStyle.Secondary);

      const buttonRow = new ActionRowBuilder().addComponents(backButton);

      return interaction.editReply({
        embeds: [embed],
        components: [selectRow, buttonRow]
      });

    } catch (error) {
      console.error('🔴 Erreur handleRewardConfig:', error);
      try {
        await interaction.editReply({
          content: '❌ Erreur lors de la configuration de la récompense.',
          embeds: [],
          components: []
        });
      } catch (e) {
        // Ignorer
      }
    }
  }

  /**
   * Handler pour la sélection du type de récompense
   * SelectMenu: mission_reward_type_{missionId}
   */
  async handleRewardTypeSelect(interaction) {
    try {
      await interaction.deferUpdate();
      const guildId = interaction.guildId;

      // Extraire missionId depuis le customId: mission_reward_type_{missionId}
      const parts = interaction.customId.split('_');
      const missionId = parseInt(parts[3]);
      const selectedType = interaction.values[0];

      // Récupérer la mission
      const mission = await db.getMissionById(guildId, missionId);
      if (!mission) {
        return interaction.editReply({
          content: '❌ Mission introuvable.',
          embeds: [],
          components: []
        });
      }

      // Si "specific-collectible", afficher le sélecteur de collectible
      if (selectedType === 'specific-collectible') {
        // Récupérer les collectibles du thème actif
        const theme = await db.getActiveTheme(guildId);
        if (!theme) {
          return interaction.editReply({
            content: '❌ Aucun thème actif. Activez un thème pour configurer un collectible spécifique.',
            embeds: [],
            components: []
          });
        }

        const collectibles = await db.queryAll(
          'SELECT id, name, rarity FROM collectibles WHERE guild_id = $1 AND theme_id = $2 ORDER BY rarity, name',
          [guildId, theme.id]
        );

        if (!collectibles || collectibles.length === 0) {
          return interaction.editReply({
            content: '❌ Aucun collectible trouvé dans le thème actif.',
            embeds: [],
            components: []
          });
        }

        const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const embed = new EmbedBuilder()
          .setTitle('🎯 Sélection du Collectible')
          .setDescription(
            `**Mission:** ${mission.name}\n\n` +
            `Choisissez le collectible que le joueur recevra en récompense:`
          )
          .setColor('#3b82f6');

        // Grouper les collectibles par rareté (max 25 options)
        const limitedCollectibles = collectibles.slice(0, 25);
        const rarityEmoji = {
          'common': '⚪',
          'rare': '🔵',
          'epic': '🟣',
          'legendary': '🟡',
          'mythic': '🔴'
        };

        const collectibleMenu = new StringSelectMenuBuilder()
          .setCustomId(`mission_reward_collectible_${missionId}`)
          .setPlaceholder('Choisir un collectible')
          .addOptions(
            limitedCollectibles.map(c => ({
              label: c.name.slice(0, 100),
              description: c.rarity,
              value: c.id.toString(),
              emoji: rarityEmoji[c.rarity] || '⚪'
            }))
          );

        const selectRow = new ActionRowBuilder().addComponents(collectibleMenu);

        // Bouton retour
        const backButton = new ButtonBuilder()
          .setCustomId(`mission_reward_config_${missionId}`)
          .setLabel('↩️ Retour aux types')
          .setStyle(ButtonStyle.Secondary);

        const buttonRow = new ActionRowBuilder().addComponents(backButton);

        return interaction.editReply({
          embeds: [embed],
          components: [selectRow, buttonRow]
        });
      }

      // Pour random-collectible ou super-bonus, sauvegarder directement
      await db.query(
        `UPDATE missions SET reward_type = $1, reward_data = NULL WHERE id = $2 AND guild_id = $3`,
        [selectedType, missionId, guildId]
      );

      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      const typeLabels = {
        'random-collectible': '🎲 Collectible aléatoire',
        'super-bonus': '⭐ Super Bonus'
      };

      const embed = new EmbedBuilder()
        .setTitle('✅ Récompense Configurée')
        .setDescription(
          `**Mission:** ${mission.name}\n\n` +
          `**Nouvelle récompense:** ${typeLabels[selectedType]}`
        )
        .setColor('#10b981');

      // Bouton retour à la mission
      const backButton = new ButtonBuilder()
        .setCustomId(`select_mission_${missionId}`)
        .setLabel('↩️ Retour à la mission')
        .setStyle(ButtonStyle.Secondary);

      const buttonRow = new ActionRowBuilder().addComponents(backButton);

      return interaction.editReply({
        embeds: [embed],
        components: [buttonRow]
      });

    } catch (error) {
      console.error('🔴 Erreur handleRewardTypeSelect:', error);
      try {
        await interaction.editReply({
          content: '❌ Erreur lors de la sélection du type de récompense.',
          embeds: [],
          components: []
        });
      } catch (e) {
        // Ignorer
      }
    }
  }

  /**
   * Handler pour la sélection d'un collectible spécifique comme récompense
   * SelectMenu: mission_reward_collectible_{missionId}
   */
  async handleRewardCollectibleSelect(interaction) {
    try {
      await interaction.deferUpdate();
      const guildId = interaction.guildId;

      // Extraire missionId depuis le customId: mission_reward_collectible_{missionId}
      const parts = interaction.customId.split('_');
      const missionId = parseInt(parts[3]);
      const collectibleId = parseInt(interaction.values[0]);

      // Récupérer la mission
      const mission = await db.getMissionById(guildId, missionId);
      if (!mission) {
        return interaction.editReply({
          content: '❌ Mission introuvable.',
          embeds: [],
          components: []
        });
      }

      // Récupérer le collectible sélectionné
      const collectible = await db.queryOne(
        'SELECT id, name, rarity FROM collectibles WHERE id = $1 AND guild_id = $2',
        [collectibleId, guildId]
      );

      if (!collectible) {
        return interaction.editReply({
          content: '❌ Collectible introuvable.',
          embeds: [],
          components: []
        });
      }

      // Sauvegarder la configuration
      const rewardData = JSON.stringify({ collectible_id: collectibleId });
      await db.query(
        `UPDATE missions SET reward_type = 'specific-collectible', reward_data = $1 WHERE id = $2 AND guild_id = $3`,
        [rewardData, missionId, guildId]
      );

      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      const rarityEmoji = {
        'common': '⚪',
        'rare': '🔵',
        'epic': '🟣',
        'legendary': '🟡',
        'mythic': '🔴'
      };

      const embed = new EmbedBuilder()
        .setTitle('✅ Récompense Configurée')
        .setDescription(
          `**Mission:** ${mission.name}\n\n` +
          `**Récompense:** 🎯 Collectible spécifique\n` +
          `**Collectible:** ${rarityEmoji[collectible.rarity] || '⚪'} ${collectible.name} (${collectible.rarity})`
        )
        .setColor('#10b981');

      // Bouton retour à la mission
      const backButton = new ButtonBuilder()
        .setCustomId(`select_mission_${missionId}`)
        .setLabel('↩️ Retour à la mission')
        .setStyle(ButtonStyle.Secondary);

      const buttonRow = new ActionRowBuilder().addComponents(backButton);

      return interaction.editReply({
        embeds: [embed],
        components: [buttonRow]
      });

    } catch (error) {
      console.error('🔴 Erreur handleRewardCollectibleSelect:', error);
      try {
        await interaction.editReply({
          content: '❌ Erreur lors de la sélection du collectible.',
          embeds: [],
          components: []
        });
      } catch (e) {
        // Ignorer
      }
    }
  }
}

module.exports = new MissionHandler();
