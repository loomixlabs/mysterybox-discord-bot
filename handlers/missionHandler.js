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
   * 🔐 Nettoyer la permission temporaire ajoutée pour une mission
   * Appelée quand une mission se termine (completed, failed, rejected, timeout)
   * @param {Client} client - Client Discord
   * @param {string} threadId - ID du thread de mission (pour lookup)
   * @param {string} guildId - ID du serveur
   */
  async cleanupTempPermissionByThread(client, threadId, guildId) {
    try {
      // Récupérer le mission_progress avec game_state
      const progressData = await db.queryOne(
        `SELECT id, game_state FROM mission_progress WHERE thread_id = $1 AND guild_id = $2`,
        [threadId, guildId]
      );

      if (!progressData?.game_state?.tempPermission) {
        return; // Pas de permission temporaire à nettoyer
      }

      const { channelId, userId } = progressData.game_state.tempPermission;

      if (!channelId || !userId) {
        console.warn(`⚠️ [PERMISSION] Données incomplètes pour nettoyage: channelId=${channelId}, userId=${userId}`);
        return;
      }

      // Récupérer le channel
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        console.warn(`⚠️ [PERMISSION] Channel ${channelId} introuvable pour nettoyage`);
        return;
      }

      // Supprimer la permission override
      await channel.permissionOverwrites.delete(userId, 'Nettoyage permission temporaire - mission terminée');
      console.log(`✅ [PERMISSION] Permission temporaire supprimée pour user ${userId} dans #${channel.name}`);

      // Mettre à jour le game_state pour retirer l'info de permission
      const updatedGameState = { ...progressData.game_state };
      delete updatedGameState.tempPermission;
      await db.query(
        `UPDATE mission_progress SET game_state = $1 WHERE id = $2`,
        [Object.keys(updatedGameState).length > 0 ? JSON.stringify(updatedGameState) : null, progressData.id]
      );
    } catch (error) {
      console.error(`🔴 [PERMISSION] Erreur nettoyage permission temporaire:`, error.message);
      // Ne pas throw - le nettoyage ne doit pas bloquer la fin de mission
    }
  }

  /**
   * 🔐 Nettoyer les permissions temporaires orphelines
   * Appelée périodiquement pour nettoyer les permissions de missions:
   * - Terminées (completed/failed) mais dont le cleanup a échoué
   * - En cours depuis trop longtemps (> 2h, probablement abandonnées)
   * @param {Client} client - Client Discord
   */
  async cleanupOrphanedPermissions(client) {
    try {
      console.log('🔍 [PERMISSION] Recherche de permissions temporaires orphelines...');

      // Récupérer TOUTES les missions avec tempPermission dans game_state:
      // 1. Missions terminées (cleanup échoué)
      // 2. Missions in_progress depuis plus de 2 heures (probablement bloquées/abandonnées)
      const orphanedMissions = await db.queryAll(`
        SELECT id, guild_id, thread_id, game_state, status, created_at
        FROM mission_progress
        WHERE game_state IS NOT NULL
          AND game_state::text LIKE '%tempPermission%'
          AND (
            status != 'in_progress'
            OR created_at < NOW() - INTERVAL '2 hours'
          )
      `);

      if (orphanedMissions.length === 0) {
        console.log('✅ [PERMISSION] Aucune permission temporaire orpheline détectée');
        return;
      }

      console.log(`🧹 [PERMISSION] ${orphanedMissions.length} permission(s) temporaire(s) orpheline(s) à nettoyer`);

      let cleaned = 0;
      for (const mission of orphanedMissions) {
        try {
          const gameState = typeof mission.game_state === 'string'
            ? JSON.parse(mission.game_state)
            : mission.game_state;

          if (!gameState?.tempPermission) continue;

          const { channelId, userId } = gameState.tempPermission;

          if (!channelId || !userId) continue;

          // Récupérer le channel
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (!channel) {
            // Channel introuvable - nettoyer quand même le game_state
            await db.query(
              `UPDATE mission_progress SET game_state = game_state - 'tempPermission' WHERE id = $1`,
              [mission.id]
            );
            continue;
          }

          // Supprimer la permission override
          try {
            await channel.permissionOverwrites.delete(userId, 'Nettoyage permission temporaire orpheline');
            console.log(`✅ [PERMISSION] Permission orpheline supprimée pour user ${userId} dans #${channel.name} (status: ${mission.status})`);
            cleaned++;
          } catch (permError) {
            // Permission déjà supprimée ou inexistante - pas grave
          }

          // Mettre à jour le game_state pour retirer l'info de permission
          await db.query(
            `UPDATE mission_progress SET game_state = game_state - 'tempPermission' WHERE id = $1`,
            [mission.id]
          );
        } catch (error) {
          console.error(`🔴 [PERMISSION] Erreur nettoyage orphelin mission ${mission.id}:`, error.message);
        }
      }

      if (cleaned > 0) {
        console.log(`✅ [PERMISSION] ${cleaned} permission(s) orpheline(s) nettoyée(s)`);
      }
    } catch (error) {
      console.error('🔴 [PERMISSION] Erreur nettoyage permissions orphelines:', error.message);
    }
  }

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

      case 'true-false':
        console.log('✅ Matched true-false case');
        await this.validateTrueFalse(interaction, mission, player, progress);
        break;

      case 'emoji-puzzle':
        console.log('✅ Matched emoji-puzzle case');
        await this.validateEmojiPuzzle(interaction, mission, player, progress);
        break;

      case 'unscramble':
        console.log('✅ Matched unscramble case');
        await this.validateUnscramble(interaction, mission, player, progress);
        break;

      case 'hangman':
        console.log('✅ Matched hangman case');
        await this.validateHangman(interaction, mission, player, progress);
        break;

      case 'wordle':
        console.log('✅ Matched wordle case');
        await this.validateWordle(interaction, mission, player, progress);
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
            // Nettoyer les permissions temporaires avant archivage
            await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
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
              // Nettoyer les permissions temporaires avant archivage
              await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
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
              // Nettoyer les permissions temporaires avant archivage
              await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
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
          // Nettoyer les permissions temporaires avant archivage
          await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
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
   * Validation True/False - Série de questions Vrai/Faux
   * - Nombre de questions = mission.max_attempts
   * - Temps par question = mission.timeout (en secondes)
   * - 100% de bonnes réponses requises pour réussir
   */
  async validateTrueFalse(interaction, mission, player, progress) {
    const guildId = interaction.guildId;
    const numberOfQuestions = mission.max_attempts || 3;
    const timePerQuestion = (mission.timeout || 30) * 1000; // Convertir en ms

    // Récupérer les questions true-false pour cette mission
    const questions = await db.getRandomTrueFalseQuestions(
      guildId,
      mission.id,
      mission.theme_id,
      numberOfQuestions
    );

    if (!questions || questions.length === 0) {
      await interaction.followUp({
        content: '❌ **Erreur:** Aucune question Vrai/Faux n\'est configurée pour cette mission.\nContacte un administrateur.'
      });
      return;
    }

    const actualQuestionCount = questions.length;
    if (actualQuestionCount < numberOfQuestions) {
      console.warn(`⚠️ Mission ${mission.id}: Seulement ${actualQuestionCount}/${numberOfQuestions} questions disponibles`);
    }

    // Labels de difficulté
    const difficultyLabels = {
      'easy': '🟢 Facile',
      'medium': '🟡 Moyen',
      'hard': '🔴 Difficile'
    };

    // Initialiser le game_state dans mission_progress
    await db.query(
      `UPDATE mission_progress SET game_state = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({
        currentQuestion: 0,
        correctAnswers: 0,
        totalQuestions: actualQuestionCount,
        answers: []
      }), progress.id]
    );

    // Introduction
    const introMsg = await interaction.followUp({
      content: `🎮 **Vrai ou Faux**\n\n` +
        `Tu vas répondre à **${actualQuestionCount} question${actualQuestionCount > 1 ? 's' : ''}**.\n` +
        `⏱️ Tu as **${mission.timeout || 30} secondes** par question.\n` +
        `🎯 Tu dois avoir **100% de bonnes réponses** pour réussir.\n\n` +
        `Prêt ? La première question arrive dans 3 secondes...`
    });

    // Attendre 3 secondes avant de commencer
    await this.sleep(3000);

    let correctCount = 0;
    let answeredCount = 0;

    // Parcourir chaque question
    for (let i = 0; i < actualQuestionCount; i++) {
      const question = questions[i];
      const questionNumber = i + 1;
      const difficulty = difficultyLabels[question.difficulty] || '🟡 Moyen';

      // Déterminer la bonne réponse (normaliser)
      const correctAnswer = question.correct_answer.toLowerCase().trim();
      const isTrue = ['vrai', 'true', 'v', 't'].includes(correctAnswer);

      // Créer les boutons Vrai/Faux
      const trueButton = new ButtonBuilder()
        .setCustomId(`tf_answer_true_${progress.id}_${i}`)
        .setLabel('✅ Vrai')
        .setStyle(ButtonStyle.Success);

      const falseButton = new ButtonBuilder()
        .setCustomId(`tf_answer_false_${progress.id}_${i}`)
        .setLabel('❌ Faux')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(trueButton, falseButton);

      // Afficher la question
      const questionEmbed = new EmbedBuilder()
        .setTitle(`❓ Question ${questionNumber}/${actualQuestionCount}`)
        .setDescription(`**${question.question_text}**`)
        .addFields({ name: 'Difficulté', value: difficulty, inline: true })
        .setColor('#3498DB')
        .setFooter({ text: `⏱️ ${mission.timeout || 30} secondes pour répondre` });

      if (question.hint) {
        questionEmbed.addFields({ name: '💡 Indice', value: question.hint, inline: false });
      }

      const questionMsg = await interaction.channel.send({
        embeds: [questionEmbed],
        components: [row]
      });

      // Attendre la réponse du joueur
      try {
        const filter = (btnInteraction) =>
          btnInteraction.user.id === interaction.user.id &&
          btnInteraction.customId.startsWith(`tf_answer_`) &&
          btnInteraction.customId.includes(`_${progress.id}_${i}`);

        const collected = await questionMsg.awaitMessageComponent({
          filter,
          time: timePerQuestion
        });

        await collected.deferUpdate();
        answeredCount++;

        const userAnsweredTrue = collected.customId.includes('_true_');
        const isCorrect = userAnsweredTrue === isTrue;

        if (isCorrect) {
          correctCount++;
          // Mettre à jour le bouton pour montrer la bonne réponse
          const correctEmbed = questionEmbed
            .setColor('#2ECC71')
            .setTitle(`✅ Question ${questionNumber}/${actualQuestionCount} - Correct !`);

          await questionMsg.edit({
            embeds: [correctEmbed],
            components: [] // Retirer les boutons
          });

          await interaction.channel.send({
            content: `✅ **Bonne réponse !** (${correctCount}/${answeredCount} correct)`
          });
        } else {
          // Mauvaise réponse
          const wrongEmbed = questionEmbed
            .setColor('#E74C3C')
            .setTitle(`❌ Question ${questionNumber}/${actualQuestionCount} - Incorrect`);

          await questionMsg.edit({
            embeds: [wrongEmbed],
            components: []
          });

          const correctText = isTrue ? 'Vrai' : 'Faux';
          await interaction.channel.send({
            content: `❌ **Mauvaise réponse !** La bonne réponse était: **${correctText}**\n(${correctCount}/${answeredCount} correct)`
          });
        }

        // Mettre à jour le game_state
        await db.query(
          `UPDATE mission_progress SET game_state = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({
            currentQuestion: i + 1,
            correctAnswers: correctCount,
            totalQuestions: actualQuestionCount,
            answers: questions.slice(0, i + 1).map((q, idx) => ({
              questionId: q.id,
              correct: idx < correctCount
            }))
          }), progress.id]
        );

        // Petite pause entre les questions
        if (i < actualQuestionCount - 1) {
          await this.sleep(2000);
        }

      } catch (error) {
        // Timeout - le joueur n'a pas répondu à temps
        answeredCount++;
        await questionMsg.edit({
          embeds: [questionEmbed.setColor('#95A5A6').setTitle(`⏰ Question ${questionNumber}/${actualQuestionCount} - Temps écoulé`)],
          components: []
        });

        const correctText = isTrue ? 'Vrai' : 'Faux';
        await interaction.channel.send({
          content: `⏰ **Temps écoulé !** La bonne réponse était: **${correctText}**`
        });

        if (i < actualQuestionCount - 1) {
          await this.sleep(2000);
        }
      }
    }

    // Calculer le résultat final
    const successRate = Math.round((correctCount / actualQuestionCount) * 100);
    const isPerfect = correctCount === actualQuestionCount;

    await this.sleep(1500);

    if (isPerfect) {
      // Mission réussie !
      const successEmbed = new EmbedBuilder()
        .setTitle('🎉 Mission Réussie !')
        .setDescription(`Bravo ! Tu as répondu correctement à **toutes les questions** !`)
        .addFields(
          { name: 'Score', value: `${correctCount}/${actualQuestionCount} (${successRate}%)`, inline: true }
        )
        .setColor('#2ECC71');

      await interaction.channel.send({ embeds: [successEmbed] });
      await this.completeMission(interaction, mission, player, progress);

    } else {
      // Mission échouée
      const failEmbed = new EmbedBuilder()
        .setTitle('❌ Mission Échouée')
        .setDescription(`Tu devais avoir **100% de bonnes réponses** pour réussir.`)
        .addFields(
          { name: 'Score', value: `${correctCount}/${actualQuestionCount} (${successRate}%)`, inline: true },
          { name: 'Requis', value: `${actualQuestionCount}/${actualQuestionCount} (100%)`, inline: true }
        )
        .setColor('#E74C3C')
        .setFooter({ text: 'Le thread se ferme dans 5 secondes...' });

      await interaction.channel.send({ embeds: [failEmbed] });

      await db.query(
        `UPDATE mission_progress SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [progress.id]
      );

      // Annonce mission échouée
      await announcements.announceMissionFailed(
        interaction.client,
        guildId,
        interaction.user.username,
        mission.name,
        `Score: ${correctCount}/${actualQuestionCount} (${successRate}%)`
      );

      // Fermer le thread après 5 secondes
      setTimeout(async () => {
        try {
          // Nettoyer les permissions temporaires avant archivage
          await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
          await interaction.channel.setArchived(true);
        } catch (error) {
          console.warn('⚠️ Impossible d\'archiver le thread');
        }
      }, 5000);
    }
  }

  /**
   * Validation emoji-puzzle avec RÉVÉLATION PROGRESSIVE
   * Les emojis apparaissent un par un. Plus le joueur devine tôt, mieux c'est !
   * Stockage: question_text = "🦁 👑 🌍" (séparés par espaces)
   * timeout = secondes entre chaque emoji (dernier tour = x3)
   * max_attempts = essais erronés autorisés au total
   */
  async validateEmojiPuzzle(interaction, mission, player, progress) {
    const guildId = interaction.guildId;

    // Récupérer un puzzle pour cette mission
    const puzzle = await db.getRandomQuizQuestionByMission(
      guildId,
      mission.id,
      mission.theme_id
    );

    if (!puzzle) {
      console.log(`❌ [Emoji-Puzzle] Aucun puzzle configuré pour mission ${mission.id}`);
      await interaction.followUp({
        content: '❌ **Erreur:** Aucun puzzle emoji n\'est configuré pour cette mission.\nContacte un administrateur.'
      });
      return;
    }

    // Parser les emojis (séparés par espaces)
    const emojiString = puzzle.question_text.trim();
    // Utiliser une regex pour extraire les emojis (caractères emoji ou séquences)
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?)/gu;
    const emojiMatches = emojiString.match(emojiRegex);

    // Fallback: séparer par espaces si pas d'emojis détectés
    const emojiParts = emojiMatches && emojiMatches.length > 0
      ? emojiMatches
      : emojiString.split(/\s+/).filter(e => e);

    if (emojiParts.length === 0) {
      console.log(`❌ [Emoji-Puzzle] Format emojis invalide: "${emojiString}"`);
      await interaction.followUp({
        content: '❌ **Erreur:** Format des emojis invalide.\nContacte un administrateur.'
      });
      return;
    }

    const answer = puzzle.correct_answer;
    const category = puzzle.hint; // hint stocke la catégorie
    const difficulty = puzzle.difficulty || 'medium';
    const totalEmojis = emojiParts.length;

    // Config timing
    const timeBetweenEmojis = (mission.timeout || 15) * 1000; // ms entre chaque emoji
    const lastRoundMultiplier = 3; // x3 pour le dernier tour

    const maxAttempts = mission.max_attempts || 5;

    console.log(`🧩 [Emoji-Puzzle] Démarrage: ${totalEmojis} emojis, ${timeBetweenEmojis/1000}s/tour, ${maxAttempts} essais max`);

    // Labels de difficulté
    const difficultyLabels = {
      'easy': '🟢 Facile',
      'medium': '🟡 Moyen',
      'hard': '🔴 Difficile'
    };
    const difficultyLabel = difficultyLabels[difficulty] || '🟡 Moyen';

    // Message d'introduction
    const introEmbed = new EmbedBuilder()
      .setTitle('🧩 Emoji Devinette - Révélation Progressive')
      .setDescription(
        `Les emojis vont apparaître **un par un** !\n\n` +
        `🏆 **Défi bonus** : Devine avec le **moins d'emojis possible** !\n\n` +
        `⏱️ Tu as **${mission.timeout || 15}s** après chaque emoji (x3 au dernier)\n` +
        `🎯 **${maxAttempts} essais** maximum au total\n` +
        `📊 Difficulté : ${difficultyLabel}`
      )
      .setColor('#9B59B6')
      .setFooter({ text: 'Premier emoji dans 3 secondes...' });

    if (category) {
      introEmbed.addFields({ name: '📂 Catégorie', value: category, inline: false });
    }

    await interaction.followUp({ embeds: [introEmbed] });
    await this.sleep(3000);

    // Variables de tracking
    let attemptCount = 0;
    let currentEmojiIndex = 0;
    let missionCompleted = false;
    let missionFailed = false;
    let revealedEmojis = [];

    // Fonction pour afficher les emojis révélés
    const getRevealedDisplay = () => revealedEmojis.join(' ');

    // Boucle de révélation progressive
    for (let i = 0; i < totalEmojis && !missionCompleted && !missionFailed; i++) {
      currentEmojiIndex = i + 1;
      revealedEmojis.push(emojiParts[i]);

      const isLastRound = (i === totalEmojis - 1);
      const timeForThisRound = isLastRound
        ? timeBetweenEmojis * lastRoundMultiplier
        : timeBetweenEmojis;

      console.log(`🧩 [Emoji-Puzzle] Tour ${currentEmojiIndex}/${totalEmojis}: "${getRevealedDisplay()}" (${timeForThisRound/1000}s)`);

      // Créer l'embed du tour
      const roundEmbed = new EmbedBuilder()
        .setTitle(`🧩 Emoji ${currentEmojiIndex}/${totalEmojis}`)
        .setDescription(`# ${getRevealedDisplay()}`)
        .addFields(
          { name: '⏱️ Temps', value: `${timeForThisRound/1000}s${isLastRound ? ' (dernier tour!)' : ''}`, inline: true },
          { name: '🎯 Essais restants', value: `${maxAttempts - attemptCount}/${maxAttempts}`, inline: true }
        )
        .setColor(isLastRound ? '#E74C3C' : '#9B59B6')
        .setFooter({ text: 'Tape ta réponse !' });

      if (currentEmojiIndex === 1) {
        roundEmbed.addFields({ name: '🏆 Défi', value: 'Devine avec 1 seul emoji = Badge spécial !', inline: false });
      }

      await interaction.channel.send({ embeds: [roundEmbed] });

      // Attendre les réponses pendant ce tour
      const roundResult = await new Promise((resolve) => {
        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({
          filter,
          time: timeForThisRound
        });

        collector.on('collect', async msg => {
          if (missionCompleted || missionFailed) return;

          attemptCount++;
          const userAnswer = msg.content.trim();

          console.log(`🧩 [Emoji-Puzzle] Essai #${attemptCount}: "${userAnswer}"`);

          const matchResult = quizAnswerMatcher.matchAnswer(userAnswer, answer, []);

          if (matchResult.isCorrect) {
            // IMPORTANT: Try/catch global pour garantir que resolve() est toujours appelé
            try {
              await msg.react('🎉');
              missionCompleted = true;
              collector.stop('success');

              const emojisNeeded = currentEmojiIndex;
              const isFirstEmoji = emojisNeeded === 1;

              console.log(`✅ [Emoji-Puzzle] Succès avec ${emojisNeeded} emoji(s)!`);

              const successEmbed = new EmbedBuilder()
                .setTitle(isFirstEmoji ? '🏆 INCROYABLE !' : '🎉 Bravo !')
                .setDescription(
                  `Tu as trouvé avec **${emojisNeeded}/${totalEmojis} emoji${emojisNeeded > 1 ? 's' : ''}** !\n\n` +
                  `${emojiString} = **${answer}**`
                )
                .setColor(isFirstEmoji ? '#FFD700' : '#2ECC71');

              if (isFirstEmoji) {
                successEmbed.addFields({
                  name: '🏆 Badge Débloqué !',
                  value: 'Tu as deviné avec 1 seul emoji !',
                  inline: false
                });

                // Déclencher le badge (si badgeHandler a cette méthode)
                try {
                  if (typeof badgeHandler.onEmojiPuzzleSolvedWithOneEmoji === 'function') {
                    await badgeHandler.onEmojiPuzzleSolvedWithOneEmoji(guildId, player.id, interaction.client);
                  }
                } catch (badgeError) {
                  console.error('⚠️ Erreur badge emoji-puzzle:', badgeError);
                }
              }

              await interaction.channel.send({ embeds: [successEmbed] });

              // Sauvegarder le résultat
              await db.query(
                `UPDATE mission_progress SET game_state = $1, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify({ emojisNeeded, totalEmojis, attempts: attemptCount }), progress.id]
              );

              await this.completeMission(interaction, mission, player, progress, msg.url);
            } catch (error) {
              console.error('🔴 [Emoji-Puzzle] Erreur lors du traitement du succès:', error);
              // Fallback: marquer la mission comme complétée même si completeMission a échoué
              try {
                await db.query(
                  `UPDATE mission_progress SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status != 'completed'`,
                  [progress.id]
                );
                console.log('✅ [Emoji-Puzzle] Mission marquée comme complétée (fallback)');

                // Archiver le thread après un délai
                setTimeout(async () => {
                  try {
                    await interaction.channel.setArchived(true);
                  } catch (archiveError) {
                    console.warn('⚠️ Impossible d\'archiver le thread (fallback)');
                  }
                }, 5000);
              } catch (fallbackError) {
                console.error('🔴 [Emoji-Puzzle] Erreur fallback:', fallbackError);
              }
            }
            resolve('success');

          } else if (matchResult.isClose) {
            await msg.react('🔶');

            if (attemptCount >= maxAttempts) {
              missionFailed = true;
              collector.stop('max_attempts');
              resolve('failed');
            } else {
              await interaction.channel.send(
                `🔶 **${matchResult.feedback || 'Tu es très proche !'}**\n` +
                `🎯 Essais restants : **${maxAttempts - attemptCount}/${maxAttempts}**`
              );
            }

          } else {
            await msg.react('❌');

            if (attemptCount >= maxAttempts) {
              missionFailed = true;
              collector.stop('max_attempts');
              resolve('failed');
            } else {
              await interaction.channel.send(
                `❌ **Ce n'est pas ça !**\n` +
                `🎯 Essais restants : **${maxAttempts - attemptCount}/${maxAttempts}**`
              );
            }
          }
        });

        collector.on('end', (collected, reason) => {
          if (reason === 'success') resolve('success');
          else if (reason === 'max_attempts') resolve('failed');
          else resolve('next'); // Timeout de ce tour
        });
      });

      if (roundResult === 'success' || roundResult === 'failed') break;

      // Annoncer le prochain emoji si ce n'est pas le dernier
      if (!isLastRound && !missionCompleted && !missionFailed) {
        await interaction.channel.send(`⏱️ Prochain emoji dans 2 secondes...`);
        await this.sleep(2000);
      }
    }

    // Gérer l'échec
    if (missionFailed) {
      await this.handleEmojiPuzzleFailed(interaction, mission, player, progress, emojiString, answer, maxAttempts, attemptCount);
    } else if (!missionCompleted) {
      console.log(`❌ [Emoji-Puzzle] Échec - tous les emojis révélés sans succès`);

      const failEmbed = new EmbedBuilder()
        .setTitle('⏰ Temps écoulé !')
        .setDescription(`Tu n'as pas trouvé la réponse.\n\n${emojiString} = **${answer}**`)
        .setColor('#E74C3C')
        .setFooter({ text: 'Le thread se ferme dans 5 secondes...' });

      await interaction.channel.send({ embeds: [failEmbed] });

      await db.query(
        `UPDATE mission_progress SET status = 'failed', game_state = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify({ emojisNeeded: null, totalEmojis, attempts: attemptCount, reason: 'timeout' }), progress.id]
      );

      await announcements.announceMissionFailed(
        interaction.client, guildId, interaction.user.username, mission.name,
        'Temps écoulé - Tous les emojis révélés'
      );

      setTimeout(async () => {
        try {
          // Nettoyer les permissions temporaires avant archivage
          await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
          await interaction.channel.setArchived(true);
        } catch (error) { console.warn('⚠️ Impossible d\'archiver le thread'); }
      }, 5000);
    }
  }

  /**
   * Helper: gérer échec emoji-puzzle (max attempts)
   */
  async handleEmojiPuzzleFailed(interaction, mission, player, progress, emojis, answer, maxAttempts, attemptCount) {
    console.log(`❌ [Emoji-Puzzle] Échec - ${attemptCount} essais épuisés`);

    const failEmbed = new EmbedBuilder()
      .setTitle('❌ Mission Échouée')
      .setDescription(
        `Tu as épuisé tes **${maxAttempts} essais**.\n\n` +
        `La bonne réponse était : **${answer}**\n\n${emojis} = ${answer}`
      )
      .setColor('#E74C3C')
      .setFooter({ text: 'Le thread se ferme dans 5 secondes...' });

    await interaction.channel.send({ embeds: [failEmbed] });

    await db.query(
      `UPDATE mission_progress SET status = 'failed', game_state = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({ emojisNeeded: null, totalEmojis: emojis.split(/\s+/).length, attempts: attemptCount, reason: 'max_attempts' }), progress.id]
    );

    await announcements.announceMissionFailed(
      interaction.client, interaction.guildId, interaction.user.username, mission.name,
      `${maxAttempts} essais épuisés`
    );

    setTimeout(async () => {
      try {
        // Nettoyer les permissions temporaires avant archivage
        await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
        await interaction.channel.setArchived(true);
      } catch (error) { console.warn('⚠️ Impossible d\'archiver le thread'); }
    }, 5000);
  }

  // ============================================================================
  // UNSCRAMBLE - Remettre les lettres dans l'ordre
  // ============================================================================

  /**
   * Mélange les lettres d'un mot de façon aléatoire
   * S'assure que le résultat est différent du mot original
   * @param {string} word - Mot à mélanger
   * @returns {string} - Mot mélangé (en majuscules)
   */
  shuffleWord(word) {
    const letters = word.toUpperCase().split('');
    const original = letters.join('');

    // Mélanger jusqu'à obtenir un résultat différent (max 50 tentatives)
    let shuffled = '';
    let attempts = 0;

    do {
      // Fisher-Yates shuffle
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      shuffled = letters.join('');
      attempts++;
    } while (shuffled === original && attempts < 50);

    return shuffled;
  }

  /**
   * Génère l'affichage visuel des lettres mélangées (style ASCII box)
   * @param {string} shuffledWord - Mot mélangé
   * @returns {string} - Affichage formaté
   */
  generateUnscrambleDisplay(shuffledWord) {
    const letters = shuffledWord.split('');
    const letterWidth = 3; // Largeur par lettre
    const totalWidth = letters.length * (letterWidth + 1) + 1;

    // Ligne du haut
    let display = '```\n';
    display += '╔' + letters.map(() => '═══').join('╦') + '╗\n';

    // Lettres
    display += '║' + letters.map(l => ` ${l} `).join('║') + '║\n';

    // Ligne du bas
    display += '╚' + letters.map(() => '═══').join('╩') + '╝\n';
    display += '```';

    return display;
  }

  /**
   * Compare la réponse utilisateur avec la réponse attendue (strict, sans tolérance)
   * @param {string} userAnswer - Réponse du joueur
   * @param {string} correctAnswer - Réponse correcte
   * @returns {boolean} - true si correct
   */
  validateUnscrambleAnswer(userAnswer, correctAnswer) {
    // Normaliser : minuscules, supprimer accents, trim
    const normalize = (str) => {
      return str
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Supprimer accents
    };

    return normalize(userAnswer) === normalize(correctAnswer);
  }

  /**
   * Validation UNSCRAMBLE - Remettre les lettres dans l'ordre
   * Utilise quiz_questions : question_text = mot original, le code mélange à l'affichage
   * Configuration : max_attempts (essais), timeout (temps total)
   */
  async validateUnscramble(interaction, mission, player, progress) {
    const guildId = interaction.guildId;

    // Récupérer un mot pour cette mission
    const wordData = await db.getRandomQuizQuestionByMission(
      guildId,
      mission.id,
      mission.theme_id
    );

    if (!wordData) {
      console.log(`❌ [Unscramble] Aucun mot configuré pour mission ${mission.id}`);
      await interaction.followUp({
        content: '❌ **Erreur:** Aucun mot n\'est configuré pour cette mission.\nContacte un administrateur.'
      });
      return;
    }

    const originalWord = wordData.correct_answer || wordData.question_text;
    const hint = wordData.hint;
    const difficulty = wordData.difficulty || 'medium';

    // Mélanger les lettres
    const shuffledWord = this.shuffleWord(originalWord);

    // Configuration
    const timeoutSeconds = mission.timeout || 60;
    const maxAttempts = mission.max_attempts || 3;

    // Labels de difficulté
    const difficultyLabels = {
      'easy': '🟢 Facile',
      'medium': '🟡 Moyen',
      'hard': '🔴 Difficile'
    };
    const difficultyLabel = difficultyLabels[difficulty] || '🟡 Moyen';

    console.log(`🔤 [Unscramble] Démarrage: "${originalWord}" → "${shuffledWord}" (${maxAttempts} essais, ${timeoutSeconds}s)`);

    // Initialiser le game_state
    await db.query(
      `UPDATE mission_progress SET game_state = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({
        originalWord,
        shuffledWord,
        attempts: 0,
        maxAttempts
      }), progress.id]
    );

    // Embed d'introduction avec les règles
    const rulesEmbed = new EmbedBuilder()
      .setTitle('🔤 UNSCRAMBLE - Lettres Mélangées')
      .setDescription(
        `**Objectif :** Remets les lettres dans le bon ordre pour former le mot !\n\n` +
        `Les lettres sont mélangées aléatoirement. Tu dois retrouver le mot original.\n\n` +
        `**Comment jouer :**\n` +
        `📝 Tape ta réponse directement dans ce thread\n` +
        `🔄 Tu peux réessayer si tu te trompes\n` +
        `⚠️ Les accents sont ignorés (é = e)`
      )
      .setColor('#3498DB')
      .addFields(
        { name: '⏱️ Temps', value: `${timeoutSeconds} secondes`, inline: true },
        { name: '🎯 Essais', value: `${maxAttempts} maximum`, inline: true },
        { name: '📊 Difficulté', value: difficultyLabel, inline: true }
      )
      .setFooter({ text: 'Le mot apparaît dans 3 secondes...' });

    await interaction.followUp({ embeds: [rulesEmbed] });
    await this.sleep(3000);

    // Générer l'affichage des lettres mélangées
    const letterDisplay = this.generateUnscrambleDisplay(shuffledWord);

    // Embed du jeu
    const gameEmbed = new EmbedBuilder()
      .setTitle('🔤 Remets les lettres dans l\'ordre !')
      .setDescription(letterDisplay)
      .setColor('#9B59B6')
      .addFields(
        { name: '📏 Nombre de lettres', value: `${originalWord.length} lettres`, inline: true },
        { name: '🎯 Essais restants', value: `${maxAttempts}/${maxAttempts}`, inline: true }
      );

    if (hint) {
      gameEmbed.addFields({ name: '💡 Indice', value: hint, inline: false });
    }

    gameEmbed.setFooter({ text: '📝 Tape ta réponse dans le chat !' });

    const gameMessage = await interaction.channel.send({ embeds: [gameEmbed] });

    // Variables de tracking
    let attemptCount = 0;
    let missionCompleted = false;

    // Créer le collecteur de messages
    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: timeoutSeconds * 1000
    });

    collector.on('collect', async msg => {
      if (missionCompleted) return;

      attemptCount++;
      const userAnswer = msg.content.trim();

      console.log(`🔤 [Unscramble] Essai #${attemptCount}: "${userAnswer}" (attendu: "${originalWord}")`);

      // Validation stricte (pas de tolérance Levenshtein)
      const isCorrect = this.validateUnscrambleAnswer(userAnswer, originalWord);

      if (isCorrect) {
        // ✅ Bonne réponse !
        await msg.react('🎉');
        missionCompleted = true;
        collector.stop('success');

        console.log(`✅ [Unscramble] Succès en ${attemptCount} essai(s) !`);

        // Mettre à jour game_state
        await db.query(
          `UPDATE mission_progress SET game_state = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({
            originalWord,
            shuffledWord,
            attempts: attemptCount,
            maxAttempts,
            success: true
          }), progress.id]
        );

        const successEmbed = new EmbedBuilder()
          .setTitle('🎉 Bravo !')
          .setDescription(
            `Tu as trouvé le mot en **${attemptCount} essai${attemptCount > 1 ? 's' : ''}** !\n\n` +
            `${shuffledWord} → **${originalWord.toUpperCase()}**`
          )
          .setColor('#2ECC71');

        await interaction.channel.send({ embeds: [successEmbed] });
        await this.completeMission(interaction, mission, player, progress, msg.url);

      } else {
        // ❌ Mauvaise réponse
        await msg.react('❌');

        if (attemptCount >= maxAttempts) {
          // Tous les essais épuisés
          collector.stop('max_attempts');

          await db.query(
            `UPDATE mission_progress SET game_state = $1, status = 'failed', updated_at = NOW() WHERE id = $2`,
            [JSON.stringify({
              originalWord,
              shuffledWord,
              attempts: attemptCount,
              maxAttempts,
              success: false,
              reason: 'max_attempts'
            }), progress.id]
          );

          const failEmbed = new EmbedBuilder()
            .setTitle('❌ Mission Échouée')
            .setDescription(
              `Tu as épuisé tes **${maxAttempts} essais**.\n\n` +
              `La bonne réponse était : **${originalWord.toUpperCase()}**\n\n` +
              `${shuffledWord} → ${originalWord.toUpperCase()}`
            )
            .setColor('#E74C3C')
            .setFooter({ text: 'Le thread se ferme dans 5 secondes...' });

          await interaction.channel.send({ embeds: [failEmbed] });

          await announcements.announceMissionFailed(
            interaction.client,
            guildId,
            interaction.user.username,
            mission.name,
            `${maxAttempts} essais épuisés`
          );

          // Fermer le thread
          setTimeout(async () => {
            try {
              await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
              await interaction.channel.setArchived(true);
            } catch (error) { console.warn('⚠️ Impossible d\'archiver le thread'); }
          }, 5000);

        } else {
          // Il reste des essais
          const remainingAttempts = maxAttempts - attemptCount;

          await interaction.channel.send(
            `❌ **Ce n'est pas ça !**\n` +
            `🎯 Essais restants : **${remainingAttempts}/${maxAttempts}**\n\n` +
            `💡 Réessaye !`
          );
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'success' || reason === 'max_attempts') {
        return; // Déjà géré
      }

      // Timeout
      console.log(`⏰ [Unscramble] Timeout - ${attemptCount} essais effectués`);

      await db.query(
        `UPDATE mission_progress SET status = 'failed', game_state = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify({
          originalWord,
          shuffledWord,
          attempts: attemptCount,
          maxAttempts,
          success: false,
          reason: 'timeout'
        }), progress.id]
      );

      const timeoutEmbed = new EmbedBuilder()
        .setTitle('⏰ Temps écoulé !')
        .setDescription(
          `Tu n'as pas trouvé le mot à temps.\n\n` +
          `La bonne réponse était : **${originalWord.toUpperCase()}**\n\n` +
          `${shuffledWord} → ${originalWord.toUpperCase()}`
        )
        .setColor('#E74C3C')
        .setFooter({ text: 'Le thread se ferme dans 5 secondes...' });

      await interaction.channel.send({ embeds: [timeoutEmbed] });

      await announcements.announceMissionFailed(
        interaction.client,
        guildId,
        interaction.user.username,
        mission.name,
        'Temps écoulé'
      );

      setTimeout(async () => {
        try {
          await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
          await interaction.channel.setArchived(true);
        } catch (error) { console.warn('⚠️ Impossible d\'archiver le thread'); }
      }, 5000);
    });
  }

  // ============================================
  // VALIDATION HANGMAN (PENDU) - VERSION INTERACTIVE
  // ============================================

  /**
   * Valider une mission de type Hangman (Pendu)
   * Version impressionnante avec:
   * - Clavier AZERTY interactif (boutons Discord)
   * - Art emoji avec expressions faciales
   * - Barre de vie avec cœurs
   * - Étoiles selon performance
   * - Double input: boutons ET texte
   */
  async validateHangman(interaction, mission, player, progress) {
    const guildId = interaction.guildId;
    const timeout = (mission.timeout || 120) * 1000; // 2 minutes par défaut
    const maxErrors = 6; // FIXE: 6 erreurs pour cohérence visuelle (6 parties du corps)

    // Récupérer un mot aléatoire
    const theme = await db.getActiveTheme(guildId);
    const words = await db.queryAll(
      `SELECT * FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3`,
      [guildId, mission.id, theme.id]
    );

    if (words.length === 0) {
      return interaction.channel.send('❌ Aucun mot configuré pour cette mission.');
    }

    const wordData = words[Math.floor(Math.random() * words.length)];
    const secretWord = wordData.correct_answer.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hint = wordData.hint;

    // Vérifier si on doit révéler la première lettre
    let validationData = mission.validation_data;
    if (typeof validationData === 'string') {
      try {
        validationData = JSON.parse(validationData);
      } catch (e) {
        validationData = {};
      }
    }
    validationData = validationData || {};
    const showFirstLetter = validationData.show_first_letter || false;

    // État du jeu
    let guessedLetters = new Set();
    let wrongLetters = new Set();
    let errorCount = 0;
    let gameEnded = false;
    let gameMessage = null;

    // Si l'option est activée, révéler la première lettre du mot
    if (showFirstLetter) {
      // Trouver la première lettre alphabétique du mot
      for (const char of secretWord) {
        if (/[A-Z]/.test(char)) {
          guessedLetters.add(char);
          console.log(`🔤 [Hangman] Première lettre révélée: ${char}`);
          break;
        }
      }
    }

    // ═══════════════════════════════════════════
    // 🎨 ART EMOJI AVEC EXPRESSIONS FACIALES
    // ═══════════════════════════════════════════
    const drawHangmanEmoji = (errors) => {
      // Expressions faciales qui évoluent avec les erreurs
      const faces = ['😊', '😐', '😰', '😨', '😱', '😵', '💀'];
      const face = faces[Math.min(errors, 6)];

      const stages = [
        // Stage 0: Potence vide
        `\`\`\`
    ╔═══════╗
    ║       ┃
    ║       ┃
    ║       ┃
    ║       ┃
    ║       ┃
════╩═══════╩════
\`\`\``,
        // Stage 1: Tête
        `\`\`\`
    ╔═══════╗
    ║   ${face}   ┃
    ║       ┃
    ║       ┃
    ║       ┃
    ║       ┃
════╩═══════╩════
\`\`\``,
        // Stage 2: Corps
        `\`\`\`
    ╔═══════╗
    ║   ${face}   ┃
    ║   │   ┃
    ║   │   ┃
    ║       ┃
    ║       ┃
════╩═══════╩════
\`\`\``,
        // Stage 3: Bras gauche
        `\`\`\`
    ╔═══════╗
    ║   ${face}   ┃
    ║  /│   ┃
    ║   │   ┃
    ║       ┃
    ║       ┃
════╩═══════╩════
\`\`\``,
        // Stage 4: Bras droit
        `\`\`\`
    ╔═══════╗
    ║   ${face}   ┃
    ║  /│\\  ┃
    ║   │   ┃
    ║       ┃
    ║       ┃
════╩═══════╩════
\`\`\``,
        // Stage 5: Jambe gauche
        `\`\`\`
    ╔═══════╗
    ║   ${face}   ┃
    ║  /│\\  ┃
    ║   │   ┃
    ║  /    ┃
    ║       ┃
════╩═══════╩════
\`\`\``,
        // Stage 6: Pendu complet
        `\`\`\`
    ╔═══════╗
    ║   💀   ┃
    ║  /│\\  ┃
    ║   │   ┃
    ║  / \\  ┃
    ║       ┃
════╩═══════╩════
\`\`\``
      ];
      return stages[Math.min(errors, 6)];
    };

    // ═══════════════════════════════════════════
    // ❤️ BARRE DE VIE AVEC CŒURS
    // ═══════════════════════════════════════════
    const getHealthBar = () => {
      const hearts = maxErrors - errorCount;
      const deadHearts = errorCount;
      return '❤️'.repeat(hearts) + '🖤'.repeat(deadHearts);
    };

    // ═══════════════════════════════════════════
    // ⭐ SYSTÈME D'ÉTOILES (VICTOIRE)
    // ═══════════════════════════════════════════
    const getStarRating = () => {
      if (errorCount === 0) return '⭐⭐⭐ PARFAIT !';
      if (errorCount <= 2) return '⭐⭐ Excellent !';
      if (errorCount <= 4) return '⭐ Bien joué !';
      return 'De justesse !';
    };

    // ═══════════════════════════════════════════
    // 📝 MOT MASQUÉ STYLISÉ
    // ═══════════════════════════════════════════
    const getMaskedWord = () => {
      return secretWord.split('').map(char => {
        if (char === ' ') return '   '; // Espace entre mots
        if (!/[A-Z]/.test(char)) return char; // Garder ponctuation
        if (guessedLetters.has(char)) {
          return `**${char}**`; // Lettre trouvée en gras
        }
        return '▢'; // Case vide stylisée
      }).join(' ');
    };

    // ═══════════════════════════════════════════
    // ⌨️ CLAVIER AZERTY INTERACTIF
    // ═══════════════════════════════════════════
    const createKeyboard = () => {
      // Clavier alphabétique en 5 rangées (max 5 boutons par rangée Discord)
      // 26 lettres = 5 rangées de 5 + 1 de 1
      const rows = [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'J'],
        ['K', 'L', 'M', 'N', 'O'],
        ['P', 'Q', 'R', 'S', 'T'],
        ['U', 'V', 'W', 'X', 'Y']
      ];
      // Note: Z sera accessible uniquement par texte (rare dans les mots français)

      const components = rows.map((row, rowIndex) => {
        const actionRow = new ActionRowBuilder();
        row.forEach(letter => {
          const isCorrect = guessedLetters.has(letter);
          const isWrong = wrongLetters.has(letter);
          const isUsed = isCorrect || isWrong;

          let style = ButtonStyle.Secondary; // Gris par défaut
          let emoji = null;

          if (isCorrect) {
            style = ButtonStyle.Success; // Vert
            emoji = '✓';
          } else if (isWrong) {
            style = ButtonStyle.Danger; // Rouge
            emoji = '✗';
          }

          const button = new ButtonBuilder()
            .setCustomId(`hangman_letter_${letter}_${progress.id}`)
            .setLabel(letter)
            .setStyle(style)
            .setDisabled(isUsed || gameEnded);

          actionRow.addComponents(button);
        });
        return actionRow;
      });

      return components;
    };

    // ═══════════════════════════════════════════
    // 🎮 EMBED DU JEU
    // ═══════════════════════════════════════════
    const createGameEmbed = (statusMessage = null) => {
      let color = '#3498DB'; // Bleu par défaut
      if (errorCount >= 5) color = '#E74C3C'; // Rouge critique
      else if (errorCount >= 3) color = '#F39C12'; // Orange attention
      else if (errorCount >= 1) color = '#F1C40F'; // Jaune léger

      const embed = new EmbedBuilder()
        .setTitle('🎮 LE PENDU')
        .setColor(color)
        .setDescription(
          drawHangmanEmoji(errorCount) + '\n\n' +
          `**${getHealthBar()}**\n\n` +
          `📝 **Mot à deviner:**\n` +
          `┌─────────────────────────────┐\n` +
          `│  ${getMaskedWord()}  │\n` +
          `└─────────────────────────────┘\n\n` +
          (statusMessage ? `${statusMessage}\n\n` : '') +
          (wrongLetters.size > 0 ? `❌ **Erreurs:** ${[...wrongLetters].join(' • ')}\n` : '')
        );

      if (hint) {
        embed.addFields({ name: '💡 Indice', value: hint, inline: false });
      }

      embed.setFooter({
        text: `⏱️ ${Math.round(timeout/1000)}s • 📱 Clique ou tape une lettre (Z au clavier) • 📖 Tape le mot entier pour deviner`
      });

      return embed;
    };

    // ═══════════════════════════════════════════
    // 🎊 EMBEDS DE FIN
    // ═══════════════════════════════════════════
    const createVictoryEmbed = () => {
      return new EmbedBuilder()
        .setTitle('🎉 VICTOIRE !')
        .setColor('#2ECC71')
        .setDescription(
          drawHangmanEmoji(errorCount) + '\n\n' +
          `${getStarRating()}\n\n` +
          `📝 **Le mot était:**\n` +
          `╔═══════════════════════════════╗\n` +
          `║  ✨ **${secretWord}** ✨  ║\n` +
          `╚═══════════════════════════════╝\n\n` +
          `❤️ **Vies restantes:** ${'❤️'.repeat(maxErrors - errorCount)}\n` +
          `⚔️ **Erreurs:** ${errorCount}/${maxErrors}`
        )
        .setThumbnail('https://em-content.zobj.net/source/apple/354/party-popper_1f389.png');
    };

    const createDefeatEmbed = () => {
      return new EmbedBuilder()
        .setTitle('☠️ PENDU !')
        .setColor('#E74C3C')
        .setDescription(
          drawHangmanEmoji(6) + '\n\n' +
          `💔 **Le mot était:**\n` +
          `╔═══════════════════════════════╗\n` +
          `║  📖 **${secretWord}**  ║\n` +
          `╚═══════════════════════════════╝\n\n` +
          `Tu pourras retenter ta chance sur une prochaine mission !`
        )
        .setFooter({ text: 'Le thread se ferme dans 5 secondes...' })
        .setThumbnail('https://em-content.zobj.net/source/apple/354/skull_1f480.png');
    };

    const createTimeoutEmbed = () => {
      return new EmbedBuilder()
        .setTitle('⏰ TEMPS ÉCOULÉ !')
        .setColor('#9B59B6')
        .setDescription(
          drawHangmanEmoji(errorCount) + '\n\n' +
          `📖 **Le mot était:** **${secretWord}**\n\n` +
          `Tu avais trouvé ${guessedLetters.size} lettre(s) correcte(s).`
        )
        .setFooter({ text: 'Le thread se ferme dans 5 secondes...' });
    };

    // ═══════════════════════════════════════════
    // 🔄 MISE À JOUR DU JEU
    // ═══════════════════════════════════════════
    const updateGame = async (statusMessage = null) => {
      if (!gameMessage || gameEnded) return;
      try {
        await gameMessage.edit({
          embeds: [createGameEmbed(statusMessage)],
          components: createKeyboard()
        });
      } catch (e) {
        console.warn('⚠️ [Hangman] Impossible de mettre à jour le message:', e.message);
      }
    };

    // Vérifier si le mot est complet
    const checkWin = () => {
      return secretWord.split('').every(char => {
        if (!/[A-Z]/.test(char)) return true;
        return guessedLetters.has(char);
      });
    };

    // ═══════════════════════════════════════════
    // 🎬 DÉMARRAGE DU JEU
    // ═══════════════════════════════════════════
    console.log(`🎮 [Hangman] Démarrage: "${secretWord}" (6 erreurs max, ${timeout/1000}s)`);

    // Envoyer le message de jeu initial
    gameMessage = await interaction.channel.send({
      embeds: [createGameEmbed('🎮 **Clique sur une lettre ou tape-la !**')],
      components: createKeyboard()
    });

    // ═══════════════════════════════════════════
    // 🎯 COLLECTEUR DE BOUTONS
    // ═══════════════════════════════════════════
    const buttonFilter = (i) => {
      return i.customId.startsWith('hangman_letter_') &&
             i.customId.endsWith(`_${progress.id}`) &&
             i.user.id === interaction.user.id;
    };

    const buttonCollector = gameMessage.createMessageComponentCollector({
      filter: buttonFilter,
      time: timeout
    });

    // ═══════════════════════════════════════════
    // 📝 COLLECTEUR DE MESSAGES (TEXTE)
    // ═══════════════════════════════════════════
    const messageFilter = m => m.author.id === interaction.user.id;
    const messageCollector = interaction.channel.createMessageCollector({
      filter: messageFilter,
      time: timeout
    });

    // ═══════════════════════════════════════════
    // 🔤 TRAITEMENT D'UNE LETTRE
    // ═══════════════════════════════════════════
    const processLetter = async (letter, source = 'button') => {
      if (gameEnded) return;

      // Lettre déjà proposée ?
      if (guessedLetters.has(letter) || wrongLetters.has(letter)) {
        await updateGame(`⚠️ Lettre **${letter}** déjà utilisée !`);
        return;
      }

      // Lettre correcte ?
      if (secretWord.includes(letter)) {
        guessedLetters.add(letter);
        console.log(`🎮 [Hangman] ✓ Lettre correcte: ${letter} (${source})`);

        if (checkWin()) {
          gameEnded = true;
          buttonCollector.stop('success');
          messageCollector.stop('success');
          return;
        }

        await updateGame(`✅ Bonne lettre : **${letter}** !`);
      } else {
        wrongLetters.add(letter);
        errorCount++;
        console.log(`🎮 [Hangman] ✗ Lettre incorrecte: ${letter} (${source}) - Erreurs: ${errorCount}/6`);

        if (errorCount >= maxErrors) {
          gameEnded = true;
          buttonCollector.stop('hanged');
          messageCollector.stop('hanged');
          return;
        }

        await updateGame(`❌ Mauvaise lettre : **${letter}** !`);
      }
    };

    // ═══════════════════════════════════════════
    // 📖 TRAITEMENT DU MOT ENTIER
    // ═══════════════════════════════════════════
    const processFullWord = async (attempt) => {
      if (gameEnded) return;

      if (attempt === secretWord) {
        // Victoire !
        guessedLetters = new Set(secretWord.split('').filter(c => /[A-Z]/.test(c)));
        gameEnded = true;
        buttonCollector.stop('success');
        messageCollector.stop('success');
      } else {
        // Pénalité : +2 erreurs
        errorCount = Math.min(errorCount + 2, maxErrors);
        console.log(`🎮 [Hangman] ✗ Mot incorrect: "${attempt}" (pénalité +2, erreurs: ${errorCount}/6)`);

        if (errorCount >= maxErrors) {
          gameEnded = true;
          buttonCollector.stop('hanged');
          messageCollector.stop('hanged');
          return;
        }

        await updateGame(`❌ **"${attempt}"** incorrect ! (+2 erreurs)`);
      }
    };

    // ═══════════════════════════════════════════
    // 🖱️ HANDLER BOUTONS
    // ═══════════════════════════════════════════
    buttonCollector.on('collect', async (buttonInteraction) => {
      try {
        await buttonInteraction.deferUpdate();

        // Extraire la lettre du customId: hangman_letter_X_progressId
        const parts = buttonInteraction.customId.split('_');
        const letter = parts[2];

        await processLetter(letter, 'button');
      } catch (error) {
        console.error('🔴 [Hangman] Erreur bouton:', error.message);
      }
    });

    // ═══════════════════════════════════════════
    // ⌨️ HANDLER MESSAGES TEXTE
    // ═══════════════════════════════════════════
    messageCollector.on('collect', async (message) => {
      const input = message.content.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      // Supprimer le message pour garder le thread propre
      try { await message.delete(); } catch (e) {}

      if (input.length === 1 && /[A-Z]/.test(input)) {
        // Lettre unique
        await processLetter(input, 'text');
      } else if (input.length > 1 && /^[A-Z\s]+$/.test(input)) {
        // Tentative de mot entier
        await processFullWord(input.replace(/\s+/g, ' '));
      }
    });

    // ═══════════════════════════════════════════
    // 🏁 FIN DU JEU
    // ═══════════════════════════════════════════
    buttonCollector.on('end', async (collected, reason) => {
      gameEnded = true;

      // Désactiver le clavier
      try {
        const disabledKeyboard = createKeyboard().map(row => {
          row.components.forEach(btn => btn.setDisabled(true));
          return row;
        });
        await gameMessage.edit({ components: disabledKeyboard });
      } catch (e) {}

      // ═══════════════════════════════════════════
      // 🎉 VICTOIRE
      // ═══════════════════════════════════════════
      if (reason === 'success') {
        console.log(`✅ [Hangman] Victoire ! ${errorCount} erreur(s)`);

        // Sauvegarder le game_state (le status sera mis à jour par completeMission)
        await db.query(
          `UPDATE mission_progress SET game_state = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({
            secretWord,
            guessedLetters: [...guessedLetters],
            wrongLetters: [...wrongLetters],
            errorCount,
            maxErrors,
            success: true
          }), progress.id]
        );

        await interaction.channel.send({ embeds: [createVictoryEmbed()] });

        // Utiliser completeMission qui gère : status, récompense, annonce, badges, archivage
        await this.completeMission(interaction, mission, player, progress, null);
      }
      // ═══════════════════════════════════════════
      // ☠️ DÉFAITE
      // ═══════════════════════════════════════════
      else if (reason === 'hanged') {
        console.log(`❌ [Hangman] Pendu ! ${errorCount} erreurs`);

        await db.query(
          `UPDATE mission_progress SET game_state = $1, status = 'failed', updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({
            secretWord,
            guessedLetters: [...guessedLetters],
            wrongLetters: [...wrongLetters],
            errorCount,
            maxErrors,
            success: false,
            reason: 'hanged'
          }), progress.id]
        );

        await interaction.channel.send({ embeds: [createDefeatEmbed()] });

        await announcements.announceMissionFailed(
          interaction.client,
          guildId,
          interaction.user.username,
          mission.name,
          'Pendu !'
        );

        setTimeout(async () => {
          try {
            await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
            await interaction.channel.setArchived(true);
          } catch (error) { console.warn('⚠️ Impossible d\'archiver le thread'); }
        }, 5000);
      }
      // ═══════════════════════════════════════════
      // ⏰ TIMEOUT
      // ═══════════════════════════════════════════
      else {
        console.log(`⏰ [Hangman] Timeout`);

        await db.query(
          `UPDATE mission_progress SET status = 'failed', game_state = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({
            secretWord,
            guessedLetters: [...guessedLetters],
            wrongLetters: [...wrongLetters],
            errorCount,
            maxErrors,
            success: false,
            reason: 'timeout'
          }), progress.id]
        );

        await interaction.channel.send({ embeds: [createTimeoutEmbed()] });

        await announcements.announceMissionFailed(
          interaction.client,
          guildId,
          interaction.user.username,
          mission.name,
          'Temps écoulé'
        );

        setTimeout(async () => {
          try {
            await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
            await interaction.channel.setArchived(true);
          } catch (error) { console.warn('⚠️ Impossible d\'archiver le thread'); }
        }, 5000);
      }
    });
  }

  // ============================================
  // GESTION DES MOTS UNSCRAMBLE (ADMIN PANEL)
  // ============================================

  /**
   * Afficher la liste des mots pour une mission Unscramble
   */
  async handleUnscrambleWordsManagement(interaction, page = 0) {
    await interaction.deferUpdate();

    // Extraire missionId - format: mission_unscramble_words_123 ou mission_unscramble_page_123_0
    const customIdParts = interaction.customId.split('_');
    let missionId;
    if (interaction.customId.includes('_page_')) {
      missionId = parseInt(customIdParts[3]);
    } else {
      missionId = parseInt(customIdParts.pop());
    }

    const guildId = interaction.guildId;

    // Utiliser la méthode helper
    return this._displayUnscrambleWordsList(interaction, guildId, missionId, page);
  }

  /**
   * Helper interne: Affiche la liste des mots (appelable sans deferUpdate)
   * @private
   */
  async _displayUnscrambleWordsList(interaction, guildId, missionId, page = 0) {

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif.',
        embeds: [],
        components: []
      });
    }

    const mission = await db.getMissionById(guildId, missionId);
    if (!mission) {
      return interaction.editReply({
        content: '❌ Mission introuvable.',
        embeds: [],
        components: []
      });
    }

    // Récupérer les mots (stockés dans quiz_questions)
    const words = await db.queryAll(
      `SELECT * FROM quiz_questions
       WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3
       ORDER BY created_at DESC`,
      [guildId, missionId, theme.id]
    );

    const itemsPerPage = 10;
    const totalPages = Math.ceil(words.length / itemsPerPage) || 1;
    const currentPage = Math.min(page, totalPages - 1);
    const startIdx = currentPage * itemsPerPage;
    const pageWords = words.slice(startIdx, startIdx + itemsPerPage);

    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`🔀 Mots à Mélanger - ${mission.name}`)
      .setDescription(
        `**${words.length}** mot(s) configuré(s)\n\n` +
        `⏱️ Temps total: **${mission.timeout || 60}s**\n` +
        `🎯 Essais max: **${mission.max_attempts || 3}**\n\n` +
        `💡 Les lettres seront mélangées aléatoirement à chaque partie !`
      )
      .setColor('#E67E22');

    if (pageWords.length > 0) {
      const wordsList = pageWords.map((w, idx) => {
        const diffEmoji = w.difficulty === 'easy' ? '🟢' : w.difficulty === 'hard' ? '🔴' : '🟡';
        const hintText = w.hint ? ` (💡 ${w.hint})` : '';
        const wordLength = w.correct_answer ? `[${w.correct_answer.length} lettres]` : '';
        return `${diffEmoji} **${w.correct_answer?.toUpperCase() || '?'}** ${wordLength}${hintText}`;
      }).join('\n');

      embed.addFields({
        name: `📋 Mots (Page ${currentPage + 1}/${totalPages})`,
        value: wordsList
      });
    } else {
      embed.addFields({
        name: '📋 Mots',
        value: '*Aucun mot configuré. Clique sur "➕ Ajouter" pour en créer un.*'
      });
    }

    // Boutons principaux
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_unscramble_add_${missionId}`)
        .setLabel('➕ Ajouter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mission_unscramble_delete_${missionId}`)
        .setLabel('🗑️ Supprimer')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(words.length === 0)
    );

    // Pagination et retour
    const pagination = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_unscramble_page_${missionId}_${currentPage - 1}`)
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId(`mission_unscramble_page_${missionId}_${currentPage + 1}`)
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`select_mission_${missionId}`)
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [buttons, pagination]
    });
  }

  /**
   * Démarrer le flow d'ajout d'un mot Unscramble (via messages, pas modal)
   */
  async handleUnscrambleWordAdd(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.followUp({ content: '❌ Aucun thème actif.', flags: 64 });
    }

    const mission = await db.getMissionById(guildId, missionId);
    if (!mission) {
      return interaction.followUp({ content: '❌ Mission introuvable.', flags: 64 });
    }

    // Étape 1: Demander le mot
    const step1Embed = new EmbedBuilder()
      .setTitle('🔀 Ajouter un Mot - Étape 1/3')
      .setDescription(
        '**Envoie le mot** que les joueurs devront deviner.\n\n' +
        '💡 **Conseils:**\n' +
        '• Choisis un mot de 5-15 lettres\n' +
        '• Évite les mots trop courts (< 4 lettres)\n' +
        '• Évite les mots trop longs (> 20 lettres)\n\n' +
        '⏱️ Tu as 2 minutes pour répondre.'
      )
      .setColor('#E67E22')
      .setFooter({ text: 'Tape "annuler" pour annuler' });

    await interaction.editReply({
      content: '',
      embeds: [step1Embed],
      components: []
    });

    const filter = m => m.author.id === interaction.user.id;

    try {
      // Collecter le mot
      const wordCollector = await interaction.channel.awaitMessages({
        filter,
        max: 1,
        time: 120000,
        errors: ['time']
      });

      const wordInput = wordCollector.first().content.trim();

      // Supprimer le message de l'utilisateur
      try { await wordCollector.first().delete(); } catch (e) { /* ignore */ }

      if (wordInput.toLowerCase() === 'annuler') {
        return this.handleUnscrambleWordsManagement(
          { ...interaction, customId: `mission_unscramble_words_${missionId}` }, 0
        );
      }

      // Validation du mot
      const word = wordInput.replace(/[^a-zA-ZÀ-ÿ]/g, ''); // Garder uniquement les lettres
      if (word.length < 3) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('❌ Mot trop court')
            .setDescription('Le mot doit contenir au moins 3 lettres.')
            .setColor('#E74C3C')
          ]
        });
        await this.sleep(2000);
        return this.handleUnscrambleWordsManagement(
          { ...interaction, customId: `mission_unscramble_words_${missionId}` }, 0
        );
      }

      if (word.length > 25) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('❌ Mot trop long')
            .setDescription('Le mot ne doit pas dépasser 25 lettres.')
            .setColor('#E74C3C')
          ]
        });
        await this.sleep(2000);
        return this.handleUnscrambleWordsManagement(
          { ...interaction, customId: `mission_unscramble_words_${missionId}` }, 0
        );
      }

      // Étape 2: Demander un indice (optionnel)
      const step2Embed = new EmbedBuilder()
        .setTitle('🔀 Ajouter un Mot - Étape 2/3')
        .setDescription(
          `✅ Mot enregistré : **${word.toUpperCase()}** (${word.length} lettres)\n\n` +
          '**Envoie un indice** pour aider les joueurs (optionnel).\n\n' +
          '💡 Ex: "Animal de la savane", "Film Disney", etc.\n\n' +
          '⏱️ Tu as 2 minutes. Tape **"aucun"** pour ne pas mettre d\'indice.'
        )
        .setColor('#E67E22')
        .setFooter({ text: 'Tape "annuler" pour annuler' });

      await interaction.editReply({
        content: '',
        embeds: [step2Embed],
        components: []
      });

      const hintCollector = await interaction.channel.awaitMessages({
        filter,
        max: 1,
        time: 120000,
        errors: ['time']
      });

      const hintInput = hintCollector.first().content.trim();
      try { await hintCollector.first().delete(); } catch (e) { /* ignore */ }

      if (hintInput.toLowerCase() === 'annuler') {
        return this.handleUnscrambleWordsManagement(
          { ...interaction, customId: `mission_unscramble_words_${missionId}` }, 0
        );
      }

      const hint = hintInput.toLowerCase() === 'aucun' ? null : hintInput.substring(0, 100);

      // Étape 3: Choisir la difficulté
      const step3Embed = new EmbedBuilder()
        .setTitle('🔀 Ajouter un Mot - Étape 3/3')
        .setDescription(
          `✅ Mot : **${word.toUpperCase()}** (${word.length} lettres)\n` +
          `💡 Indice : ${hint || '*Aucun*'}\n\n` +
          '**Choisis la difficulté :**'
        )
        .setColor('#E67E22');

      const difficultyButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`unscramble_diff_easy_${missionId}`)
          .setLabel('🟢 Facile')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`unscramble_diff_medium_${missionId}`)
          .setLabel('🟡 Moyen')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`unscramble_diff_hard_${missionId}`)
          .setLabel('🔴 Difficile')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        content: '',
        embeds: [step3Embed],
        components: [difficultyButtons]
      });

      // Collecter le choix de difficulté
      const diffCollector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('unscramble_diff_'),
        time: 60000,
        max: 1
      });

      diffCollector.on('collect', async (i) => {
        await i.deferUpdate();

        const difficulty = i.customId.includes('_easy_') ? 'easy' :
                          i.customId.includes('_hard_') ? 'hard' : 'medium';

        // Sauvegarder le mot dans quiz_questions
        await db.query(
          `INSERT INTO quiz_questions (guild_id, theme_id, mission_id, question_text, correct_answer, hint, difficulty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [guildId, theme.id, missionId, word, word, hint, difficulty]
        );

        // Mettre à jour validation_data avec le nouveau compte
        const wordsCount = await db.queryOne(
          `SELECT COUNT(*) as count FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2`,
          [guildId, missionId]
        );

        await db.query(
          `UPDATE missions SET validation_data = $1 WHERE id = $2 AND guild_id = $3`,
          [JSON.stringify({ words_count: parseInt(wordsCount.count) }), missionId, guildId]
        );

        const diffEmoji = difficulty === 'easy' ? '🟢' : difficulty === 'hard' ? '🔴' : '🟡';

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Mot ajouté !')
          .setDescription(
            `**${word.toUpperCase()}** a été ajouté à la mission.\n\n` +
            `${diffEmoji} Difficulté: **${difficulty === 'easy' ? 'Facile' : difficulty === 'hard' ? 'Difficile' : 'Moyen'}**\n` +
            `💡 Indice: ${hint || '*Aucun*'}`
          )
          .setColor('#2ECC71');

        await i.editReply({
          embeds: [successEmbed],
          components: []
        });

        // Retourner à la liste après 2 secondes
        await this.sleep(2000);
        return this._displayUnscrambleWordsList(i, guildId, missionId, 0);
      });

      diffCollector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setTitle('⏱️ Temps écoulé')
              .setDescription('La création du mot a été annulée.')
              .setColor('#E74C3C')
            ],
            components: []
          });
          await this.sleep(2000);
          return this._displayUnscrambleWordsList(interaction, guildId, missionId, 0);
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du mot unscramble:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('⏱️ Temps écoulé')
          .setDescription('La création du mot a été annulée.')
          .setColor('#E74C3C')
        ],
        components: []
      });
      await this.sleep(2000);
      return this._displayUnscrambleWordsList(interaction, guildId, missionId, 0);
    }
  }

  /**
   * Afficher le select menu pour supprimer un mot Unscramble
   */
  async handleUnscrambleWordDeleteSelect(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({ content: '❌ Aucun thème actif.', embeds: [], components: [] });
    }

    // Récupérer les mots
    const words = await db.queryAll(
      `SELECT id, correct_answer, hint, difficulty FROM quiz_questions
       WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3
       ORDER BY created_at DESC
       LIMIT 25`,
      [guildId, missionId, theme.id]
    );

    if (words.length === 0) {
      return interaction.editReply({
        content: '❌ Aucun mot à supprimer.',
        embeds: [],
        components: []
      });
    }

    // Créer le select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_unscramble_delete_${missionId}`)
      .setPlaceholder('Sélectionne un mot à supprimer')
      .addOptions(words.map(w => {
        const diffEmoji = w.difficulty === 'easy' ? '🟢' : w.difficulty === 'hard' ? '🔴' : '🟡';
        return {
          label: w.correct_answer?.toUpperCase() || '???',
          value: w.id.toString(),
          description: w.hint ? `${diffEmoji} ${w.hint.substring(0, 50)}` : `${diffEmoji} Aucun indice`
        };
      }));

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Supprimer un mot')
      .setDescription('Sélectionne le mot que tu veux supprimer.')
      .setColor('#E74C3C');

    const cancelButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_unscramble_words_${missionId}`)
        .setLabel('🔙 Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        cancelButton
      ]
    });
  }

  /**
   * Supprimer un mot Unscramble (après sélection dans le select menu)
   */
  async handleUnscrambleWordDelete(interaction) {
    await interaction.deferReply({ flags: 64 });

    const wordId = parseInt(interaction.values[0]);
    const guildId = interaction.guildId;

    // Extraire missionId du customId: select_unscramble_delete_123
    const missionId = parseInt(interaction.customId.split('_').pop());

    // Récupérer le mot avant de le supprimer pour le log
    const word = await db.queryOne(
      'SELECT correct_answer FROM quiz_questions WHERE id = $1 AND guild_id = $2',
      [wordId, guildId]
    );

    // Supprimer le mot
    await db.query(
      'DELETE FROM quiz_questions WHERE id = $1 AND guild_id = $2',
      [wordId, guildId]
    );

    console.log(`🗑️ [Unscramble] Mot "${word?.correct_answer}" #${wordId} supprimé`);

    // Mettre à jour le compteur dans validation_data
    const wordsCount = await db.queryOne(
      `SELECT COUNT(*) as count FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2`,
      [guildId, missionId]
    );

    await db.query(
      `UPDATE missions SET validation_data = $1 WHERE id = $2 AND guild_id = $3`,
      [JSON.stringify({ words_count: parseInt(wordsCount.count) }), missionId, guildId]
    );

    await interaction.editReply({
      content: `✅ Mot **${word?.correct_answer?.toUpperCase() || ''}** supprimé !`,
      flags: 64
    });

    // Retourner à la liste des mots en mettant à jour le message original
    const messageInteraction = {
      editReply: interaction.message.edit.bind(interaction.message),
      guildId: guildId
    };

    return this._displayUnscrambleWordsList(messageInteraction, guildId, missionId, 0);
  }

  // ============================================
  // GESTION DES MOTS HANGMAN (ADMIN PANEL)
  // ============================================

  /**
   * Afficher la liste des mots pour une mission Hangman
   */
  async handleHangmanWordsManagement(interaction, page = 0) {
    await interaction.deferUpdate();

    // Extraire missionId - format: mission_hangman_words_123 ou mission_hangman_page_123_0
    const customIdParts = interaction.customId.split('_');
    let missionId;
    if (interaction.customId.includes('_page_')) {
      missionId = parseInt(customIdParts[3]);
    } else {
      missionId = parseInt(customIdParts.pop());
    }

    const guildId = interaction.guildId;

    // Utiliser la méthode helper
    return this._displayHangmanWordsList(interaction, guildId, missionId, page);
  }

  /**
   * Helper interne: Affiche la liste des mots hangman (appelable sans deferUpdate)
   * @private
   */
  async _displayHangmanWordsList(interaction, guildId, missionId, page = 0) {

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif.',
        embeds: [],
        components: []
      });
    }

    const mission = await db.getMissionById(guildId, missionId);
    if (!mission) {
      return interaction.editReply({
        content: '❌ Mission introuvable.',
        embeds: [],
        components: []
      });
    }

    // Récupérer les mots (stockés dans quiz_questions)
    const words = await db.getQuizQuestionsByMission(guildId, missionId);

    const perPage = 10;
    const totalPages = Math.max(1, Math.ceil(words.length / perPage));
    const currentPage = Math.min(page, totalPages - 1);
    const pageWords = words.slice(currentPage * perPage, (currentPage + 1) * perPage);

    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`☠️ Mots du Pendu - ${mission.name}`)
      .setColor('#9B59B6')
      .setDescription(
        `📊 **${words.length}** mot${words.length > 1 ? 's' : ''} configuré${words.length > 1 ? 's' : ''}\n\n` +
        (pageWords.length > 0
          ? pageWords.map((w, i) => {
              const diffEmoji = w.difficulty === 'easy' ? '🟢' : w.difficulty === 'hard' ? '🔴' : '🟡';
              const hint = w.hint ? ` | *${w.hint.substring(0, 30)}${w.hint.length > 30 ? '...' : ''}*` : '';
              return `${diffEmoji} **${w.correct_answer?.toUpperCase() || '???'}** (${w.correct_answer?.length || 0} lettres)${hint}`;
            }).join('\n')
          : '*Aucun mot configuré. Utilise le bouton pour en ajouter !*')
      )
      .setFooter({ text: `Page ${currentPage + 1}/${totalPages} | 6 erreurs = pendu !` });

    // Boutons de gestion
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_hangman_add_${missionId}`)
        .setLabel('➕ Ajouter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mission_hangman_delete_${missionId}`)
        .setLabel('🗑️ Supprimer')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(words.length === 0)
    );

    // Pagination
    const pagination = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_hangman_page_${missionId}_${currentPage - 1}`)
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId(`mission_hangman_page_${missionId}_${currentPage + 1}`)
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`admin_missions`)
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [buttons, pagination]
    });
  }

  /**
   * Ajouter un mot à une mission Hangman (avec boutons de difficulté comme Unscramble)
   */
  async handleHangmanWordAdd(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({ content: '❌ Aucun thème actif.', embeds: [], components: [] });
    }

    // Embed instruction - Étape 1
    const instructionEmbed = new EmbedBuilder()
      .setTitle('☠️ Ajouter un Mot au Pendu - Étape 1/3')
      .setDescription(
        '**Envoie le mot** à deviner dans le chat.\n\n' +
        '📝 **Règles:**\n' +
        '• Le mot sera automatiquement mis en majuscules\n' +
        '• Les accents seront retirés\n' +
        '• Un mot de **5-15 lettres** est idéal\n' +
        '• Tu peux mettre plusieurs mots (phrase)\n\n' +
        '⏱️ Tu as 2 minutes. Tape **"annuler"** pour annuler.'
      )
      .setColor('#9B59B6');

    await interaction.editReply({
      content: '',
      embeds: [instructionEmbed],
      components: []
    });

    try {
      // Collecter le mot
      const filter = m => m.author.id === interaction.user.id;
      const collected = await interaction.channel.awaitMessages({
        filter,
        max: 1,
        time: 120000,
        errors: ['time']
      });

      const wordInput = collected.first().content.trim();
      try { await collected.first().delete(); } catch (e) {}

      if (wordInput.toLowerCase() === 'annuler') {
        return this._displayHangmanWordsList(interaction, guildId, missionId, 0);
      }

      // Normaliser le mot
      const word = wordInput.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Vérifier que le mot contient au moins une lettre
      if (!/[A-Z]/.test(word)) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('❌ Mot invalide')
            .setDescription('Le mot doit contenir au moins une lettre.')
            .setColor('#E74C3C')
          ]
        });
        await this.sleep(2000);
        return this._displayHangmanWordsList(interaction, guildId, missionId, 0);
      }

      // Vérifier si le mot n'est pas trop long
      if (word.length > 30) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('❌ Mot trop long')
            .setDescription('Le mot ne doit pas dépasser 30 caractères.')
            .setColor('#E74C3C')
          ]
        });
        await this.sleep(2000);
        return this._displayHangmanWordsList(interaction, guildId, missionId, 0);
      }

      // Vérifier si le mot existe déjà
      const existingWord = await db.queryOne(
        `SELECT id FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2 AND UPPER(correct_answer) = $3`,
        [guildId, missionId, word]
      );

      if (existingWord) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('❌ Mot déjà existant')
            .setDescription(`Le mot **${word}** existe déjà dans cette mission.`)
            .setColor('#E74C3C')
          ]
        });
        await this.sleep(2000);
        return this._displayHangmanWordsList(interaction, guildId, missionId, 0);
      }

      // Étape 2: Demander un indice (optionnel)
      const step2Embed = new EmbedBuilder()
        .setTitle('☠️ Ajouter un Mot au Pendu - Étape 2/3')
        .setDescription(
          `✅ Mot enregistré : **${word}** (${word.replace(/[^A-Z]/g, '').length} lettres)\n\n` +
          '**Envoie un indice** pour aider les joueurs (optionnel).\n\n' +
          '💡 Ex: "Personnage principal", "Animal magique", etc.\n\n' +
          '⏱️ Tu as 2 minutes. Tape **"aucun"** pour ne pas mettre d\'indice.'
        )
        .setColor('#9B59B6')
        .setFooter({ text: 'Tape "annuler" pour annuler' });

      await interaction.editReply({
        content: '',
        embeds: [step2Embed],
        components: []
      });

      const hintCollector = await interaction.channel.awaitMessages({
        filter,
        max: 1,
        time: 120000,
        errors: ['time']
      });

      const hintInput = hintCollector.first().content.trim();
      try { await hintCollector.first().delete(); } catch (e) {}

      if (hintInput.toLowerCase() === 'annuler') {
        return this._displayHangmanWordsList(interaction, guildId, missionId, 0);
      }

      const hint = hintInput.toLowerCase() === 'aucun' ? null : hintInput.substring(0, 100);

      // Étape 3: Choisir la difficulté avec des boutons
      const step3Embed = new EmbedBuilder()
        .setTitle('☠️ Ajouter un Mot au Pendu - Étape 3/3')
        .setDescription(
          `✅ Mot : **${word}** (${word.replace(/[^A-Z]/g, '').length} lettres)\n` +
          `💡 Indice : ${hint || '*Aucun*'}\n\n` +
          '**Choisis la difficulté :**'
        )
        .setColor('#9B59B6');

      const difficultyButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hangman_diff_easy_${missionId}`)
          .setLabel('🟢 Facile')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`hangman_diff_medium_${missionId}`)
          .setLabel('🟡 Moyen')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`hangman_diff_hard_${missionId}`)
          .setLabel('🔴 Difficile')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        content: '',
        embeds: [step3Embed],
        components: [difficultyButtons]
      });

      // Collecter le choix de difficulté
      const diffCollector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('hangman_diff_'),
        time: 60000,
        max: 1
      });

      diffCollector.on('collect', async (i) => {
        await i.deferUpdate();

        const difficulty = i.customId.includes('_easy_') ? 'easy' :
                          i.customId.includes('_hard_') ? 'hard' : 'medium';

        // Sauvegarder le mot dans quiz_questions
        await db.query(
          `INSERT INTO quiz_questions (guild_id, theme_id, mission_id, question_text, correct_answer, hint, difficulty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [guildId, theme.id, missionId, `Devine le mot: ${word}`, word, hint, difficulty]
        );

        // Mettre à jour validation_data avec le nouveau compte
        const wordsCount = await db.queryOne(
          `SELECT COUNT(*) as count FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2`,
          [guildId, missionId]
        );

        await db.query(
          `UPDATE missions SET validation_data = $1 WHERE id = $2 AND guild_id = $3`,
          [JSON.stringify({ words_count: parseInt(wordsCount.count) }), missionId, guildId]
        );

        const diffEmoji = difficulty === 'easy' ? '🟢' : difficulty === 'hard' ? '🔴' : '🟡';
        console.log(`☠️ [Hangman] Mot ajouté: "${word}" [${difficulty}]`);

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Mot ajouté !')
          .setDescription(
            `**${word}** a été ajouté à la mission.\n\n` +
            `${diffEmoji} Difficulté: **${difficulty === 'easy' ? 'Facile' : difficulty === 'hard' ? 'Difficile' : 'Moyen'}**\n` +
            `💡 Indice: ${hint || '*Aucun*'}`
          )
          .setColor('#2ECC71');

        await i.editReply({
          embeds: [successEmbed],
          components: []
        });

        // Retourner à la liste après 2 secondes
        await this.sleep(2000);
        return this._displayHangmanWordsList(i, guildId, missionId, 0);
      });

      diffCollector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setTitle('⏱️ Temps écoulé')
              .setDescription('La création du mot a été annulée.')
              .setColor('#E74C3C')
            ],
            components: []
          });
          await this.sleep(2000);
          return this._displayHangmanWordsList(interaction, guildId, missionId, 0);
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du mot hangman:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('⏱️ Temps écoulé')
          .setDescription('La création du mot a été annulée.')
          .setColor('#E74C3C')
        ],
        components: []
      });
      await this.sleep(2000);
      return this._displayHangmanWordsList(interaction, guildId, missionId, 0);
    }
  }

  /**
   * Afficher le select menu pour supprimer un mot Hangman
   */
  async handleHangmanWordDeleteSelect(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({ content: '❌ Aucun thème actif.', embeds: [], components: [] });
    }

    // Récupérer les mots
    const words = await db.queryAll(
      `SELECT id, correct_answer, hint, difficulty FROM quiz_questions
       WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3
       ORDER BY created_at DESC
       LIMIT 25`,
      [guildId, missionId, theme.id]
    );

    if (words.length === 0) {
      return interaction.editReply({
        content: '❌ Aucun mot à supprimer.',
        embeds: [],
        components: []
      });
    }

    // Créer le select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_hangman_delete_${missionId}`)
      .setPlaceholder('Sélectionne un mot à supprimer')
      .addOptions(words.map(w => {
        const diffEmoji = w.difficulty === 'easy' ? '🟢' : w.difficulty === 'hard' ? '🔴' : '🟡';
        return {
          label: w.correct_answer?.toUpperCase() || '???',
          value: w.id.toString(),
          description: w.hint ? `${diffEmoji} ${w.hint.substring(0, 50)}` : `${diffEmoji} Aucun indice`
        };
      }));

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Supprimer un mot du Pendu')
      .setDescription('Sélectionne le mot que tu veux supprimer.')
      .setColor('#E74C3C');

    const cancelButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_hangman_words_${missionId}`)
        .setLabel('🔙 Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        cancelButton
      ]
    });
  }

  /**
   * Supprimer un mot Hangman (après sélection dans le select menu)
   */
  async handleHangmanWordDelete(interaction) {
    await interaction.deferReply({ flags: 64 });

    const wordId = parseInt(interaction.values[0]);
    const guildId = interaction.guildId;

    // Extraire missionId du customId: select_hangman_delete_123
    const missionId = parseInt(interaction.customId.split('_').pop());

    // Récupérer le mot avant de le supprimer pour le log
    const word = await db.queryOne(
      'SELECT correct_answer FROM quiz_questions WHERE id = $1 AND guild_id = $2',
      [wordId, guildId]
    );

    // Supprimer le mot
    await db.query(
      'DELETE FROM quiz_questions WHERE id = $1 AND guild_id = $2',
      [wordId, guildId]
    );

    console.log(`🗑️ [Hangman] Mot "${word?.correct_answer}" #${wordId} supprimé`);

    // Mettre à jour le compteur dans validation_data
    const wordsCount = await db.queryOne(
      `SELECT COUNT(*) as count FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2`,
      [guildId, missionId]
    );

    await db.query(
      `UPDATE missions SET validation_data = $1 WHERE id = $2 AND guild_id = $3`,
      [JSON.stringify({ words_count: parseInt(wordsCount.count) }), missionId, guildId]
    );

    await interaction.editReply({
      content: `✅ Mot **${word?.correct_answer?.toUpperCase() || ''}** supprimé !`,
      flags: 64
    });

    // Retourner à la liste des mots en mettant à jour le message original
    const messageInteraction = {
      editReply: interaction.message.edit.bind(interaction.message),
      guildId: guildId
    };

    return this._displayHangmanWordsList(messageInteraction, guildId, missionId, 0);
  }

  /**
   * Toggle l'option "première lettre révélée" pour une mission Hangman
   */
  async handleHangmanFirstLetterToggle(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    // Récupérer la mission
    const mission = await db.queryOne(
      'SELECT * FROM missions WHERE id = $1 AND guild_id = $2',
      [missionId, guildId]
    );

    if (!mission) {
      return interaction.editReply({ content: '❌ Mission introuvable.', embeds: [], components: [] });
    }

    // Parser validation_data
    let validationData = mission.validation_data;
    if (typeof validationData === 'string') {
      try {
        validationData = JSON.parse(validationData);
      } catch (e) {
        validationData = {};
      }
    }
    validationData = validationData || {};

    // Toggle l'option
    const newValue = !validationData.show_first_letter;
    validationData.show_first_letter = newValue;

    // Mettre à jour en base
    await db.query(
      `UPDATE missions SET validation_data = $1 WHERE id = $2 AND guild_id = $3`,
      [JSON.stringify(validationData), missionId, guildId]
    );

    console.log(`🔤 [Hangman] Mission #${missionId} - 1ère lettre: ${newValue ? 'révélée' : 'cachée'}`);

    // Rafraîchir la vue de la mission via adminPanelHandler.handleMissionSelection
    // On crée un objet interaction modifié avec le customId attendu
    const adminPanelHandler = require('./adminPanelHandler');
    const modifiedInteraction = Object.create(interaction);
    modifiedInteraction.customId = `select_mission_${missionId}`;
    modifiedInteraction.values = null; // Pas de select menu
    modifiedInteraction.deferUpdate = async () => {}; // Déjà fait
    return adminPanelHandler.handleMissionSelection(modifiedInteraction);
  }

  /**
   * Utilitaire: attendre N millisecondes
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

        // Utiliser addCollectibleWithLevels pour le système d'évolution
        const evolutionResult = await db.addCollectibleWithLevels(
          interaction.guildId,
          player.id,
          collectible.id,
          'mission'
        );

        if (evolutionResult.isNew) {
          // Nouveau collectible
          const playerProgress = await db.incrementProgress(interaction.guildId, player.id, mission.theme_id);

          // Message de récompense
          const rewardEmbed = new EmbedBuilder()
            .setTitle('🎉 Mission Réussie !')
            .setDescription(
              `Félicitations ! Tu as terminé la mission **${mission.name}** !\n\n` +
              `**Récompense:** ${collectible.name}` +
              (evolutionResult.mintNumber ? `\n🏷️ **Mint #${evolutionResult.mintNumber}**` : '')
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
          // Fusion (doublon) - le collectible gagne de l'XP !
          const embed = new EmbedBuilder()
            .setTitle('🔄 Mission Réussie - Fusion !')
            .setDescription(
              `Tu as terminé la mission **${mission.name}** !\n\n` +
              `**${collectible.name}** a fusionné avec ton exemplaire existant !\n` +
              `✨ **+100 XP** │ Niveau ${evolutionResult.level} ${'★'.repeat(evolutionResult.level)}\n` +
              `📊 XP: ${evolutionResult.currentXp}/${evolutionResult.nextLevelXp || 'MAX'}`
            )
            .setColor(0xF1C40F);

          // Thumbnail uniquement si URL valide (non vide)
          if (collectible.image_url && collectible.image_url.trim()) {
            embed.setThumbnail(collectible.image_url);
          }

          // Ajouter info level up si applicable
          if (evolutionResult.leveledUp) {
            embed.addFields({
              name: '🎉 LEVEL UP !',
              value: `Niveau ${evolutionResult.previousLevel} → Niveau ${evolutionResult.level}`,
              inline: true
            });
          }

          embed.setFooter(await getLoomixFooter(interaction.guildId));

          await interaction.channel.send({ embeds: [embed] });

          // 📢 ANNONCES D'ÉVOLUTION - Envoyer dans le canal d'annonces
          try {
            const MAX_LEVEL = 4;
            if (evolutionResult.leveledUp) {
              if (evolutionResult.level >= MAX_LEVEL) {
                // Niveau maximum atteint !
                await announcements.announceCollectibleMaxLevel(
                  interaction.client,
                  interaction.guildId,
                  interaction.user.username,
                  collectible.name,
                  evolutionResult.level,
                  evolutionResult.mintNumber,
                  null  // Pas d'image générée pour les missions
                );
              } else {
                // Level up normal
                await announcements.announceCollectibleLevelUp(
                  interaction.client,
                  interaction.guildId,
                  interaction.user.username,
                  collectible.name,
                  evolutionResult.previousLevel,
                  evolutionResult.level,
                  evolutionResult.currentXp || 0,
                  evolutionResult.nextLevelXp || 100,
                  null  // Pas d'image générée pour les missions
                );
              }
            }
          } catch (announceError) {
            console.error('🔴 [MISSION] Erreur annonce évolution:', announceError);
          }
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

      // 🏆 BADGE TRACKING - Mission Completed (avec détails pour badges spécifiques)
      try {
        const missionDetails = {
          missionType: mission.type,
          missionName: mission.name,
          duration: progress?.started_at ? (new Date() - new Date(progress.started_at)) / 1000 : null, // en secondes
          isFlawless: !progress?.failed_attempts || progress.failed_attempts === 0
        };
        await badgeHandler.onMissionCompletedWithDetails(interaction.guildId, player.id, missionDetails, interaction.client);
        console.log(`🏆 [BADGES] Mission badge tracking appelé pour player ${player.id} (type: ${mission.type})`);
      } catch (error) {
        console.error('🔴 [BADGES] Erreur tracking mission:', error);
      }

      // Message immédiat + fermeture après 10 secondes
      await interaction.channel.send('✅ **Mission terminée !** Le thread se ferme dans 10 secondes...');

      setTimeout(async () => {
        try {
          // Nettoyer les permissions temporaires avant archivage
          await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
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

          // Utiliser addCollectibleWithLevels pour le système d'évolution
          const evolutionResult = await db.addCollectibleWithLevels(
            interaction.guildId,
            player.id,
            collectible.id,
            'mission'
          );

          if (evolutionResult.isNew) {
            // Nouveau collectible
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

            await interaction.channel.send({
              content: `✅ Mission **${progressData.mission_name}** validée pour <@${progressData.discord_id}> !\n🎁 Récompense : **${collectible.name}**` +
                (evolutionResult.mintNumber ? ` 🏷️ Mint #${evolutionResult.mintNumber}` : '')
            });
          } else {
            // Fusion (doublon) - afficher le level up
            let fusionMsg = `✅ Mission **${progressData.mission_name}** validée pour <@${progressData.discord_id}> !\n` +
              `🔄 **${collectible.name}** a fusionné ! ✨ +100 XP │ Niveau ${evolutionResult.level} ${'★'.repeat(evolutionResult.level)}`;

            if (evolutionResult.leveledUp) {
              fusionMsg += `\n🎉 **LEVEL UP !** Niveau ${evolutionResult.previousLevel} → ${evolutionResult.level}`;
            }

            await interaction.channel.send({ content: fusionMsg });

            // 📢 ANNONCES D'ÉVOLUTION - Envoyer dans le canal d'annonces
            try {
              const MAX_LEVEL = 4;
              if (evolutionResult.leveledUp) {
                if (evolutionResult.level >= MAX_LEVEL) {
                  // Niveau maximum atteint !
                  await announcements.announceCollectibleMaxLevel(
                    interaction.client,
                    interaction.guildId,
                    progressData.username,
                    collectible.name,
                    evolutionResult.level,
                    evolutionResult.mintNumber,
                    null  // Pas d'image générée pour les missions
                  );
                } else {
                  // Level up normal
                  await announcements.announceCollectibleLevelUp(
                    interaction.client,
                    interaction.guildId,
                    progressData.username,
                    collectible.name,
                    evolutionResult.previousLevel,
                    evolutionResult.level,
                    evolutionResult.currentXp || 0,
                    evolutionResult.nextLevelXp || 100,
                    null  // Pas d'image générée pour les missions
                  );
                }
              }
            } catch (announceError) {
              console.error('🔴 [MISSION APPROVE] Erreur annonce évolution:', announceError);
            }
          }
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
          // Nettoyer les permissions temporaires avant archivage
          await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
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
   * Admin clique sur "🎯 Nombre d'essais/questions" pour configurer max_attempts
   * Adapte les textes selon le type de mission (quiz = essais, true-false = questions)
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

      // Adapter les textes selon le type de mission
      const isTrueFalse = mission.type === 'true-false';
      const isQuestionBased = ['true-false', 'emoji-puzzle', 'wordle', 'unscramble', 'hangman'].includes(mission.type);

      let title, description, currentValueText, placeholder, optionLabel, optionDesc;

      if (isTrueFalse || isQuestionBased) {
        // Pour true-false et autres mini-jeux: max_attempts = nombre de questions
        title = '🎯 Configurer le Nombre de Questions';
        currentValueText = mission.max_attempts === null ? '3 (défaut)' : `${mission.max_attempts} question(s)`;
        description = `**Mission:** ${mission.name}\n\n` +
          `**Valeur actuelle:** ${currentValueText}\n\n` +
          '📝 Choisis combien de questions le joueur devra répondre.\n\n' +
          '• Le joueur doit répondre correctement à **toutes les questions** pour réussir\n' +
          '• Chaque question a un temps limité (configuré via Timeout)';
        placeholder = '🎯 Choisir le nombre de questions';
        optionLabel = (i) => `${i} question${i > 1 ? 's' : ''}`;
        optionDesc = (i) => `Série de ${i} question${i > 1 ? 's' : ''}`;
      } else {
        // Pour quiz classique: max_attempts = nombre d'essais
        title = '🎯 Configurer le Nombre d\'Essais';
        currentValueText = mission.max_attempts === null ? 'Illimité' : `${mission.max_attempts} essai(s)`;
        description = `**Mission:** ${mission.name}\n\n` +
          `**Valeur actuelle:** ${currentValueText}\n\n` +
          '📝 Choisis le nombre maximum d\'essais que le joueur aura pour cette mission quiz.\n\n' +
          '• **Illimité**: Le joueur peut essayer autant de fois qu\'il veut (limité par le timeout)\n' +
          '• **1-10**: Nombre d\'essais fixes avant échec automatique';
        placeholder = '🎯 Choisir le nombre d\'essais';
        optionLabel = (i) => `${i} essai${i > 1 ? 's' : ''}`;
        optionDesc = (i) => `Maximum ${i} tentative${i > 1 ? 's' : ''}`;
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      // Créer le select menu
      const options = [];

      // Option illimité seulement pour quiz classique
      if (!isQuestionBased) {
        options.push({ label: '♾️ Illimité', description: 'Essais illimités (limité par timeout)', value: 'unlimited' });
      }

      // Ajouter les options 1-10 (ou 3-10 pour mini-jeux)
      const startValue = isQuestionBased ? 1 : 1;
      for (let i = startValue; i <= 10; i++) {
        options.push({
          label: optionLabel(i),
          description: optionDesc(i),
          value: i.toString()
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`mission_max_attempts_select_${missionId}`)
        .setPlaceholder(placeholder)
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
   * Admin clique sur "Modifier Nom/Description" - Affiche le modal d'édition
   */
  async handleMissionEditInfo(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Récupérer la mission
      const mission = await db.getMissionById(interaction.guildId, missionId);

      if (!mission) {
        return interaction.reply({
          content: '❌ Mission introuvable.',
          flags: 64
        });
      }

      // Créer le modal d'édition
      const modal = new ModalBuilder()
        .setCustomId(`modal_mission_edit_info_${missionId}`)
        .setTitle('✏️ Modifier la mission');

      const nameInput = new TextInputBuilder()
        .setCustomId('mission_name')
        .setLabel('Nom de la mission')
        .setStyle(TextInputStyle.Short)
        .setValue(mission.name || '')
        .setPlaceholder('Ex: Quiz Harry Potter')
        .setRequired(true)
        .setMaxLength(100);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('mission_description')
        .setLabel('Description de la mission')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(mission.description || '')
        .setPlaceholder('Décris le but de cette mission...')
        .setRequired(false)
        .setMaxLength(500);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(descriptionInput)
      );

      return interaction.showModal(modal);

    } catch (error) {
      console.error('🔴 Erreur handleMissionEditInfo:', error);
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
                  // Nettoyer les permissions temporaires avant archivage
                  await this.cleanupTempPermissionByThread(client, mission.thread_id, mission.guild_id);
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

  // ============================================================
  // SECTION: TRUE-FALSE ADMIN HANDLERS
  // ============================================================

  /**
   * Admin clique sur "Gérer les Questions V/F" (True-False mission)
   * Affiche la liste des questions Vrai/Faux pour cette mission
   */
  async handleTrueFalseQuestionsManagement(interaction, page = 0) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      if (!mission || mission.type !== 'true-false') {
        return interaction.reply({
          content: '❌ Cette mission n\'est pas de type Vrai ou Faux.',
          flags: 64
        });
      }

      // Récupérer toutes les questions V/F de cette mission spécifique
      // On utilise la même table quiz_questions mais filtré par correct_answer IN ('vrai', 'faux')
      const questions = await db.queryAll(
        `SELECT * FROM quiz_questions
         WHERE guild_id = $1 AND mission_id = $2
         AND LOWER(correct_answer) IN ('vrai', 'faux', 'true', 'false')
         ORDER BY id`,
        [interaction.guildId, mission.id]
      );

      // Pagination (20 questions par page pour rester sous la limite de 25 fields)
      const questionsPerPage = 20;
      const totalPages = Math.ceil(questions.length / questionsPerPage) || 1;
      const currentPage = Math.min(Math.max(0, page), totalPages - 1);
      const startIndex = currentPage * questionsPerPage;
      const endIndex = startIndex + questionsPerPage;
      const paginatedQuestions = questions.slice(startIndex, endIndex);

      const embed = new EmbedBuilder()
        .setTitle(`✅ Questions Vrai/Faux - ${mission.name}`)
        .setDescription(questions.length === 0
          ? '**Aucune question n\'a encore été créée.**\n\nCliquez sur "Ajouter une Question" pour commencer.\n\n💡 **Info:** Pour les missions Vrai/Faux, la réponse doit être "Vrai" ou "Faux".'
          : `**${questions.length} question(s) enregistrée(s)** (Page ${currentPage + 1}/${totalPages})`)
        .setColor(branding.secondary_color);

      if (paginatedQuestions.length > 0) {
        paginatedQuestions.forEach((q, i) => {
          const answerEmoji = q.correct_answer.toLowerCase() === 'vrai' || q.correct_answer.toLowerCase() === 'true' ? '✅' : '❌';
          const answerText = q.correct_answer.toLowerCase() === 'vrai' || q.correct_answer.toLowerCase() === 'true' ? 'VRAI' : 'FAUX';

          embed.addFields({
            name: `${startIndex + i + 1}. ${q.question_text}`,
            value: `${answerEmoji} Réponse: **${answerText}**\n💡 Difficulté: ${q.difficulty}${q.hint ? `\n💭 Indice: ${q.hint}` : ''}`,
            inline: false
          });
        });
      }

      embed.setFooter(await getLoomixFooter(interaction.guildId));

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_truefalse_add_${missionId}`)
          .setLabel('➕ Ajouter une Question')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`mission_truefalse_questions_${missionId}:${currentPage}`)
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
          .setCustomId(`select_truefalse_delete_${missionId}`)
          .setPlaceholder('🗑️ Supprimer une question de cette page')
          .addOptions(
            paginatedQuestions.map((q, index) => ({
              label: `Q${startIndex + index + 1}: ${q.question_text.substring(0, 80)}${q.question_text.length > 80 ? '...' : ''}`,
              value: q.id.toString(),
              description: `Réponse: ${q.correct_answer}`
            }))
          );

        components.push(new ActionRowBuilder().addComponents(deleteMenu));
      }

      // Ajouter boutons de pagination si nécessaire
      if (totalPages > 1) {
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_truefalse_page_${missionId}:${Math.max(0, currentPage - 1)}`)
            .setLabel('◀️ Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId(`mission_truefalse_page_${missionId}:${Math.min(totalPages - 1, currentPage + 1)}`)
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
      console.error('🔴 Erreur handleTrueFalseQuestionsManagement:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin clique sur "Ajouter une Question" (True-False mission)
   * Étape 1: Afficher le sélecteur de difficulté
   */
  async handleTrueFalseAdd(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      await interaction.deferUpdate();

      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      if (!mission || mission.type !== 'true-false') {
        return interaction.editReply({
          content: '❌ Cette mission n\'est pas de type Vrai ou Faux.',
          components: []
        });
      }

      // Créer l'embed avec les instructions
      const embed = new EmbedBuilder()
        .setTitle('✅ Ajouter une Question Vrai/Faux')
        .setDescription(
          '**Instructions:**\n\n' +
          '1️⃣ Choisis la **difficulté** de la question dans le menu ci-dessous\n' +
          '2️⃣ Un formulaire s\'ouvrira pour saisir:\n' +
          '   • L\'affirmation (ex: La Terre est plate)\n' +
          '   • La réponse correcte (Vrai ou Faux)\n' +
          '   • Un indice optionnel\n\n' +
          '**Niveaux de difficulté:**\n' +
          '🟢 **Facile** - Affirmations évidentes (ex: Le soleil brille le jour)\n' +
          '🟡 **Moyen** - Affirmations standard (ex: Paris est en Allemagne)\n' +
          '🔴 **Difficile** - Affirmations subtiles (ex: dates précises, détails)\n\n' +
          '💡 Le joueur aura un temps limité pour répondre Vrai ou Faux.'
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      // Menu de sélection de difficulté
      const difficultySelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`truefalse_difficulty_select_${missionId}`)
          .setPlaceholder('🎯 Choisir la difficulté de la question')
          .addOptions([
            {
              label: 'Facile',
              description: 'Affirmation évidente',
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
              description: 'Affirmation subtile',
              value: 'hard',
              emoji: '🔴'
            }
          ])
      );

      // Bouton retour
      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_truefalse_questions_${missionId}`)
          .setLabel('↩️ Retour à la liste')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [difficultySelect, backButton]
      });

    } catch (error) {
      console.error('🔴 Erreur handleTrueFalseAdd:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin sélectionne une difficulté pour une question Vrai/Faux
   * Étape 2: Afficher le sélecteur de réponse (Vrai ou Faux)
   */
  async handleTrueFalseDifficultySelect(interaction) {
    const missionId = parseInt(interaction.customId.split('_')[3]);
    const difficulty = interaction.values[0]; // easy, medium ou hard

    try {
      await interaction.deferUpdate();

      // Récupérer la mission et le branding
      const [mission, branding] = await Promise.all([
        db.getMissionById(interaction.guildId, missionId),
        db.getGuildBranding(interaction.guildId)
      ]);

      const difficultyEmojis = { 'easy': '🟢', 'medium': '🟡', 'hard': '🔴' };
      const difficultyLabels = { 'easy': 'Facile', 'medium': 'Moyen', 'hard': 'Difficile' };

      // Créer l'embed pour le choix de la réponse
      const embed = new EmbedBuilder()
        .setTitle(`${difficultyEmojis[difficulty]} Question Vrai/Faux (${difficultyLabels[difficulty]})`)
        .setDescription(
          '**Étape 2:** Choisis la réponse correcte\n\n' +
          'Sélectionne si ta prochaine affirmation sera **vraie** ou **fausse**.\n\n' +
          '✅ **Vrai** - L\'affirmation que tu vas saisir est correcte\n' +
          '❌ **Faux** - L\'affirmation que tu vas saisir est incorrecte'
        )
        .setColor(branding.secondary_color)
        .setFooter(await getLoomixFooter(interaction.guildId));

      // Menu de sélection de la réponse
      const answerSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`truefalse_answer_select_${missionId}_${difficulty}`)
          .setPlaceholder('🎯 Choisir la réponse correcte')
          .addOptions([
            {
              label: 'Vrai',
              description: 'L\'affirmation est correcte',
              value: 'vrai',
              emoji: '✅'
            },
            {
              label: 'Faux',
              description: 'L\'affirmation est incorrecte',
              value: 'faux',
              emoji: '❌'
            }
          ])
      );

      // Bouton retour
      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_truefalse_add_${missionId}`)
          .setLabel('↩️ Retour au choix de difficulté')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [answerSelect, backButton]
      });

    } catch (error) {
      console.error('🔴 Erreur handleTrueFalseDifficultySelect:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Admin sélectionne Vrai ou Faux comme réponse
   * Étape 3: Ouvrir le modal pour saisir l'affirmation
   */
  async handleTrueFalseAnswerSelect(interaction) {
    // customId format: truefalse_answer_select_{missionId}_{difficulty}
    const parts = interaction.customId.split('_');
    const missionId = parseInt(parts[3]);
    const difficulty = parts[4];
    const answer = interaction.values[0]; // vrai ou faux

    try {
      const difficultyEmojis = { 'easy': '🟢', 'medium': '🟡', 'hard': '🔴' };
      const difficultyLabels = { 'easy': 'Facile', 'medium': 'Moyen', 'hard': 'Difficile' };
      const answerEmoji = answer === 'vrai' ? '✅' : '❌';
      const answerLabel = answer === 'vrai' ? 'VRAI' : 'FAUX';

      // Afficher un modal pour saisir l'affirmation
      const modal = new ModalBuilder()
        .setCustomId(`modal_truefalse_add_${missionId}_${difficulty}_${answer}`)
        .setTitle(`${difficultyEmojis[difficulty]} Question V/F - ${answerLabel}`);

      const questionInput = new TextInputBuilder()
        .setCustomId('question')
        .setLabel(`Affirmation (réponse: ${answerLabel})`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(answer === 'vrai'
          ? 'Ex: La Terre tourne autour du Soleil'
          : 'Ex: La Terre est plate')
        .setRequired(true)
        .setMaxLength(500);

      const hintInput = new TextInputBuilder()
        .setCustomId('hint')
        .setLabel('Indice (optionnel)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Pensez à la forme de la Terre')
        .setRequired(false)
        .setMaxLength(200);

      const row1 = new ActionRowBuilder().addComponents(questionInput);
      const row2 = new ActionRowBuilder().addComponents(hintInput);

      modal.addComponents(row1, row2);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('🔴 Erreur handleTrueFalseAnswerSelect:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        flags: 64
      });
    }
  }

  /**
   * Supprimer une question Vrai/Faux
   */
  async handleTrueFalseQuestionDelete(interaction) {
    const questionId = parseInt(interaction.values[0]);
    const missionId = parseInt(interaction.customId.split('_')[3]);

    try {
      await interaction.deferUpdate();

      // Récupérer la question avant suppression
      const question = await db.queryOne(
        'SELECT * FROM quiz_questions WHERE id = $1 AND guild_id = $2',
        [questionId, interaction.guildId]
      );

      if (!question) {
        return interaction.editReply({
          content: '❌ Question introuvable.',
          components: []
        });
      }

      // Supprimer la question
      await db.query(
        'DELETE FROM quiz_questions WHERE id = $1 AND guild_id = $2',
        [questionId, interaction.guildId]
      );

      // Logger l'action
      await audit.logMissionQuizQuestionDeleted(
        interaction.guildId,
        interaction.user.id,
        missionId,
        question.question_text
      );

      // Rafraîchir la liste
      // Créer une fausse interaction avec le bon customId pour réutiliser handleTrueFalseQuestionsManagement
      const fakeInteraction = {
        ...interaction,
        customId: `mission_truefalse_questions_${missionId}`,
        update: interaction.editReply.bind(interaction),
        reply: interaction.reply.bind(interaction)
      };

      return this.handleTrueFalseQuestionsManagement(fakeInteraction, 0);

    } catch (error) {
      console.error('🔴 Erreur handleTrueFalseQuestionDelete:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la suppression.',
        flags: 64
      });
    }
  }

  // ============================================
  // GESTION DES PUZZLES EMOJI (Admin Panel)
  // ============================================

  /**
   * Afficher la liste des puzzles emoji pour une mission
   */
  async handleEmojiPuzzleManagement(interaction, page = 0) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif.',
        embeds: [],
        components: []
      });
    }

    const mission = await db.getMissionById(guildId, missionId);
    if (!mission) {
      return interaction.editReply({
        content: '❌ Mission introuvable.',
        embeds: [],
        components: []
      });
    }

    // Récupérer les puzzles
    const puzzles = await db.queryAll(
      `SELECT * FROM quiz_questions
       WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3
       ORDER BY created_at DESC`,
      [guildId, missionId, theme.id]
    );

    const itemsPerPage = 5;
    const totalPages = Math.ceil(puzzles.length / itemsPerPage) || 1;
    const currentPage = Math.min(page, totalPages - 1);
    const startIdx = currentPage * itemsPerPage;
    const pagePuzzles = puzzles.slice(startIdx, startIdx + itemsPerPage);

    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle(`🧩 Puzzles Emoji - ${mission.name}`)
      .setDescription(
        `**${puzzles.length}** puzzle(s) configuré(s)\n\n` +
        `⏱️ Temps par emoji: **${mission.timeout || 15}s** (x3 au dernier)\n` +
        `🎯 Essais max: **${mission.max_attempts || 5}**\n\n` +
        `🏆 **Défi bonus**: Le joueur peut gagner un badge s'il devine avec 1 seul emoji !`
      )
      .setColor('#9B59B6');

    if (pagePuzzles.length > 0) {
      const puzzlesList = pagePuzzles.map((p, idx) => {
        const diffEmoji = p.difficulty === 'easy' ? '🟢' : p.difficulty === 'hard' ? '🔴' : '🟡';
        const categoryTag = p.hint ? ` [${p.hint}]` : '';
        return `${diffEmoji} **${p.question_text}** → ${p.correct_answer}${categoryTag}`;
      }).join('\n');

      embed.addFields({
        name: `📋 Puzzles (Page ${currentPage + 1}/${totalPages})`,
        value: puzzlesList
      });
    } else {
      embed.addFields({
        name: '📋 Puzzles',
        value: '*Aucun puzzle configuré. Clique sur "➕ Ajouter" pour en créer un.*'
      });
    }

    // Boutons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_emoji_add_${missionId}`)
        .setLabel('➕ Ajouter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`mission_emoji_delete_${missionId}`)
        .setLabel('🗑️ Supprimer')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(puzzles.length === 0)
    );

    // Pagination
    const pagination = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_emoji_page_${missionId}_${currentPage - 1}`)
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId(`mission_emoji_page_${missionId}_${currentPage + 1}`)
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId('admin_missions')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [buttons, pagination]
    });
  }

  /**
   * Démarrer le flow d'ajout d'un puzzle emoji (basé sur message, pas modal)
   */
  async handleEmojiPuzzleAdd(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.followUp({ content: '❌ Aucun thème actif.', flags: 64 });
    }

    const mission = await db.getMissionById(guildId, missionId);
    if (!mission) {
      return interaction.followUp({ content: '❌ Mission introuvable.', flags: 64 });
    }

    // Étape 1: Demander les emojis
    const step1Embed = new EmbedBuilder()
      .setTitle('🧩 Ajouter un Puzzle Emoji - Étape 1/3')
      .setDescription(
        '**Envoie les emojis** qui représentent ta devinette.\n\n' +
        '💡 **Utilise le sélecteur d\'emojis Discord !**\n' +
        'Ex: 🦁👑 pour "Le Roi Lion"\n\n' +
        '⏱️ Tu as 2 minutes pour répondre.'
      )
      .setColor('#9B59B6')
      .setFooter({ text: 'Tape "annuler" pour annuler' });

    await interaction.editReply({
      content: '',
      embeds: [step1Embed],
      components: []
    });

    const filter = m => m.author.id === interaction.user.id;

    // Collecter les emojis
    try {
      const emojiCollector = await interaction.channel.awaitMessages({
        filter,
        max: 1,
        time: 120000,
        errors: ['time']
      });

      const emojiMsg = emojiCollector.first();
      if (emojiMsg.content.toLowerCase() === 'annuler') {
        return interaction.editReply({ content: '❌ Annulé.', embeds: [], components: [] });
      }

      const emojis = emojiMsg.content.trim();
      await emojiMsg.delete().catch(() => {});

      // Étape 2: Demander la réponse
      const step2Embed = new EmbedBuilder()
        .setTitle('🧩 Ajouter un Puzzle Emoji - Étape 2/3')
        .setDescription(
          `**Emojis enregistrés:** ${emojis}\n\n` +
          '**Quelle est la réponse ?**\n' +
          'Ex: Le Roi Lion\n\n' +
          '⏱️ Tu as 2 minutes pour répondre.'
        )
        .setColor('#9B59B6')
        .setFooter({ text: 'Tape "annuler" pour annuler' });

      await interaction.editReply({ embeds: [step2Embed] });

      const answerCollector = await interaction.channel.awaitMessages({
        filter,
        max: 1,
        time: 120000,
        errors: ['time']
      });

      const answerMsg = answerCollector.first();
      if (answerMsg.content.toLowerCase() === 'annuler') {
        return interaction.editReply({ content: '❌ Annulé.', embeds: [], components: [] });
      }

      const answer = answerMsg.content.trim();
      await answerMsg.delete().catch(() => {});

      // Étape 3: Demander la catégorie
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(`emoji_category_temp_${missionId}`)
        .setPlaceholder('Choisis la catégorie')
        .addOptions([
          { label: '🎬 Film', value: 'Film 🎬', description: 'Film ou série' },
          { label: '👤 Personnage', value: 'Personnage 👤', description: 'Personnage célèbre' },
          { label: '🎵 Musique', value: 'Musique 🎵', description: 'Chanson ou artiste' },
          { label: '🍕 Nourriture', value: 'Nourriture 🍕', description: 'Plat ou aliment' },
          { label: '🏟️ Lieu', value: 'Lieu 🏟️', description: 'Pays, ville, monument' },
          { label: '📖 Expression', value: 'Expression 📖', description: 'Expression ou dicton' },
          { label: '🎮 Jeu', value: 'Jeu 🎮', description: 'Jeu vidéo ou de société' },
          { label: '❓ Autre', value: 'Autre ❓', description: 'Autre catégorie' }
        ]);

      const step3Embed = new EmbedBuilder()
        .setTitle('🧩 Ajouter un Puzzle Emoji - Étape 3/4')
        .setDescription(
          `**Emojis:** ${emojis}\n` +
          `**Réponse:** ${answer}\n\n` +
          '**Choisis la catégorie:**'
        )
        .setColor('#9B59B6');

      await interaction.editReply({
        embeds: [step3Embed],
        components: [new ActionRowBuilder().addComponents(categorySelect)]
      });

      // Attendre la sélection de catégorie
      const catInteraction = await interaction.channel.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('emoji_category_temp_'),
        time: 60000
      });

      await catInteraction.deferUpdate();
      const category = catInteraction.values[0]; // Stocké dans hint

      // Étape 4: Demander la difficulté
      const difficultySelect = new StringSelectMenuBuilder()
        .setCustomId(`emoji_difficulty_temp_${missionId}`)
        .setPlaceholder('Choisis la difficulté')
        .addOptions([
          { label: '🟢 Facile', value: 'easy', description: 'Emoji évident' },
          { label: '🟡 Moyen', value: 'medium', description: 'Réflexion nécessaire' },
          { label: '🔴 Difficile', value: 'hard', description: 'Très abstrait' }
        ]);

      const step4Embed = new EmbedBuilder()
        .setTitle('🧩 Ajouter un Puzzle Emoji - Étape 4/4')
        .setDescription(
          `**Emojis:** ${emojis}\n` +
          `**Réponse:** ${answer}\n` +
          `**Catégorie:** ${category}\n\n` +
          '**Choisis la difficulté:**'
        )
        .setColor('#9B59B6');

      await interaction.editReply({
        embeds: [step4Embed],
        components: [new ActionRowBuilder().addComponents(difficultySelect)]
      });

      // Attendre la sélection de difficulté
      const diffInteraction = await interaction.channel.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('emoji_difficulty_temp_'),
        time: 60000
      });

      await diffInteraction.deferUpdate();
      const difficulty = diffInteraction.values[0];

      // Sauvegarder le puzzle
      await db.addQuizQuestion(
        guildId,
        theme.id,
        emojis,   // question_text = emojis
        answer,   // correct_answer
        [],       // wrong_answers (pas utilisé)
        category, // hint = catégorie
        difficulty,
        missionId
      );

      console.log(`✅ [Emoji-Puzzle] Puzzle ajouté: "${emojis}" → "${answer}" [${category}] (${difficulty})`);

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Puzzle Ajouté !')
        .setDescription(
          `**Emojis:** ${emojis}\n` +
          `**Réponse:** ${answer}\n` +
          `**Catégorie:** ${category}\n` +
          `**Difficulté:** ${difficulty === 'easy' ? '🟢 Facile' : difficulty === 'hard' ? '🔴 Difficile' : '🟡 Moyen'}`
        )
        .setColor('#2ECC71');

      await interaction.editReply({
        embeds: [successEmbed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`mission_emoji_puzzles_${missionId}`)
              .setLabel('📋 Voir les puzzles')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`mission_emoji_add_${missionId}`)
              .setLabel('➕ Ajouter un autre')
              .setStyle(ButtonStyle.Success)
          )
        ]
      });

    } catch (error) {
      if (error.message === 'time') {
        return interaction.editReply({
          content: '⏰ Temps écoulé. Opération annulée.',
          embeds: [],
          components: []
        });
      }
      console.error('🔴 Erreur handleEmojiPuzzleAdd:', error);
      return interaction.editReply({
        content: '❌ Une erreur est survenue.',
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher le sélecteur pour supprimer un puzzle emoji
   */
  async handleEmojiPuzzleDeleteSelect(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    const puzzles = await db.queryAll(
      `SELECT id, question_text, correct_answer FROM quiz_questions
       WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3
       ORDER BY created_at DESC LIMIT 25`,
      [guildId, missionId, theme.id]
    );

    if (puzzles.length === 0) {
      return interaction.editReply({
        content: '❌ Aucun puzzle à supprimer.',
        embeds: [],
        components: []
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`select_emoji_delete_${missionId}`)
      .setPlaceholder('Choisis le puzzle à supprimer')
      .addOptions(puzzles.map(p => ({
        label: `${p.question_text.substring(0, 50)} → ${p.correct_answer.substring(0, 30)}`,
        value: p.id.toString(),
        description: `ID: ${p.id}`
      })));

    return interaction.editReply({
      content: '🗑️ **Sélectionne le puzzle à supprimer:**',
      embeds: [],
      components: [
        new ActionRowBuilder().addComponents(select),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_emoji_puzzles_${missionId}`)
            .setLabel('🔙 Retour')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  /**
   * Supprimer un puzzle emoji
   */
  async handleEmojiPuzzleDelete(interaction) {
    await interaction.deferReply({ flags: 64 });

    const puzzleId = parseInt(interaction.values[0]);
    const guildId = interaction.guildId;

    // Extraire missionId du customId
    const missionId = parseInt(interaction.customId.split('_').pop());

    await db.query(
      'DELETE FROM quiz_questions WHERE id = $1 AND guild_id = $2',
      [puzzleId, guildId]
    );

    console.log(`🗑️ [Emoji-Puzzle] Puzzle #${puzzleId} supprimé`);

    await interaction.editReply({
      content: '✅ Puzzle supprimé !',
      flags: 64
    });

    // Retourner à la liste
    const fakeInteraction = {
      ...interaction,
      customId: `mission_emoji_puzzles_${missionId}`,
      deferUpdate: async () => {},
      editReply: interaction.message.edit.bind(interaction.message)
    };

    return this.handleEmojiPuzzleManagement(fakeInteraction, 0);
  }

  // ╔════════════════════════════════════════════════════════════════════════════╗
  // ║                                                                            ║
  // ║   🟩🟨⬛ WORDLE - LE JEU ULTIME DE DÉDUCTION                             ║
  // ║   Interface graphique premium avec clavier AZERTY interactif              ║
  // ║                                                                            ║
  // ╚════════════════════════════════════════════════════════════════════════════╝

  /**
   * Valider une mission de type Wordle
   * 🎮 Version premium avec:
   * - Grille visuelle 6x5 avec animations d'état
   * - Clavier AZERTY interactif avec couleurs dynamiques
   * - Système d'étoiles basé sur le nombre d'essais
   * - Support saisie au clavier ET boutons
   * - Option première lettre révélée
   */
  async validateWordle(interaction, mission, player, progress) {
    const guildId = interaction.guildId;
    const timeout = (mission.timeout || 180) * 1000; // 3 minutes par défaut

    // Récupérer la config depuis validation_data
    let validationData = mission.validation_data;
    if (typeof validationData === 'string') {
      try { validationData = JSON.parse(validationData); } catch (e) { validationData = {}; }
    }
    validationData = validationData || {};

    // ═══════════════════════════════════════════════════════════════════════
    // 📚 RÉCUPÉRATION DU MOT SECRET
    // ═══════════════════════════════════════════════════════════════════════
    const theme = await db.getActiveTheme(guildId);
    const words = await db.queryAll(
      `SELECT * FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3`,
      [guildId, mission.id, theme.id]
    );

    if (words.length === 0) {
      return interaction.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('❌ Erreur de configuration')
          .setDescription('Aucun mot configuré pour cette mission Wordle.\nUn administrateur doit ajouter des mots.')
          .setColor('#E74C3C')
        ]
      });
    }

    const wordData = words[Math.floor(Math.random() * words.length)];
    const secretWord = wordData.correct_answer.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hint = wordData.hint;
    const wordDifficulty = wordData.difficulty || 'easy'; // easy, medium, hard

    // Déterminer la longueur attendue et le nombre d'essais selon la difficulté du mot
    // Facile = 5 lettres (8 essais), Moyen = 6 lettres (6 essais), Difficile = 7 lettres (4 essais)
    const wordLength = wordDifficulty === 'easy' ? 5 : wordDifficulty === 'hard' ? 7 : 6;
    const difficultyKey = `${wordDifficulty}_attempts`;
    // Défauts logiques selon difficulté: easy=8, medium=6, hard=4
    const defaultAttempts = wordDifficulty === 'easy' ? 8 : wordDifficulty === 'hard' ? 4 : 6;
    const maxAttempts = Math.min(10, Math.max(3, parseInt(validationData[difficultyKey]) || defaultAttempts));
    const diffEmoji = wordDifficulty === 'easy' ? '🟢' : wordDifficulty === 'hard' ? '🔴' : '🟡';
    const diffLabel = wordDifficulty === 'easy' ? 'Facile' : wordDifficulty === 'hard' ? 'Difficile' : 'Moyen';

    // Vérifier que le mot a la bonne longueur
    if (secretWord.replace(/[^A-Z]/g, '').length !== wordLength) {
      console.warn(`⚠️ [Wordle] Mot "${secretWord}" n'a pas ${wordLength} lettres (difficulté: ${wordDifficulty}) !`);
      return interaction.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('❌ Erreur de configuration')
          .setDescription(`Le mot sélectionné ne fait pas ${wordLength} lettres.\nContactez un administrateur.`)
          .setColor('#E74C3C')
        ]
      });
    }

    // Vérifier option première lettre révélée
    const showFirstLetter = validationData.show_first_letter || false;

    // ═══════════════════════════════════════════════════════════════════════
    // 🎮 ÉTAT DU JEU
    // ═══════════════════════════════════════════════════════════════════════
    const attempts = []; // Historique des tentatives: [{word: 'TRACE', result: ['🟩','🟨','⬛','⬛','🟩']}]
    let currentInput = showFirstLetter ? secretWord[0] : ''; // Saisie en cours
    let gameEnded = false;
    let gameMessage = null;

    // État du clavier: 'unused' | 'correct' | 'present' | 'absent'
    const keyboardState = {};
    'AZERTYUIOPQSDFGHJKLMWXCVBN'.split('').forEach(l => keyboardState[l] = 'unused');

    // Si première lettre révélée, la marquer comme correcte
    if (showFirstLetter) {
      keyboardState[secretWord[0]] = 'correct';
    }

    console.log(`🟩 [Wordle] Démarrage: "${secretWord}" (${diffLabel}, ${wordLength} lettres, ${maxAttempts} essais, ${timeout/1000}s)`);

    // ═══════════════════════════════════════════════════════════════════════
    // 🎨 GÉNÉRATION DE LA GRILLE PREMIUM
    // ═══════════════════════════════════════════════════════════════════════
    const createGrid = () => {
      const grid = [];

      // Ligne de titre avec effet visuel
      grid.push('```ansi');
      grid.push('\u001b[1;37m╔═══════════════════════╗\u001b[0m');
      grid.push('\u001b[1;37m║\u001b[0m   \u001b[1;32m🟩\u001b[0m \u001b[1;33mW O R D L E\u001b[0m \u001b[1;32m🟩\u001b[0m   \u001b[1;37m║\u001b[0m');
      grid.push('\u001b[1;37m╠═══════════════════════╣\u001b[0m');

      // Afficher les tentatives passées
      for (let i = 0; i < maxAttempts; i++) {
        if (i < attempts.length) {
          // Tentative déjà faite
          const attempt = attempts[i];
          const letters = attempt.word.split('').map((letter, idx) => {
            const result = attempt.result[idx];
            if (result === '🟩') return `\u001b[1;42;37m ${letter} \u001b[0m`; // Vert fond
            if (result === '🟨') return `\u001b[1;43;30m ${letter} \u001b[0m`; // Jaune fond
            return `\u001b[1;40;37m ${letter} \u001b[0m`; // Gris fond
          }).join('');
          grid.push(`\u001b[1;37m║\u001b[0m ${letters} \u001b[1;37m║\u001b[0m`);
        } else if (i === attempts.length) {
          // Ligne de saisie actuelle
          const inputDisplay = currentInput.padEnd(wordLength, '_').split('').map((char, idx) => {
            if (char === '_') return `\u001b[1;34m ▢ \u001b[0m`; // Case vide bleue
            // Si première lettre révélée, afficher en vert
            if (idx === 0 && showFirstLetter) return `\u001b[1;42;37m ${char} \u001b[0m`;
            return `\u001b[1;47;30m ${char} \u001b[0m`; // Lettre en cours (blanc)
          }).join('');
          grid.push(`\u001b[1;37m║\u001b[0m ${inputDisplay} \u001b[1;37m║\u001b[0m ◀ \u001b[1;36mTon essai\u001b[0m`);
        } else {
          // Lignes futures vides
          const emptyRow = Array(wordLength).fill('\u001b[1;34m ▢ \u001b[0m').join('');
          grid.push(`\u001b[1;37m║\u001b[0m ${emptyRow} \u001b[1;37m║\u001b[0m`);
        }
      }

      grid.push('\u001b[1;37m╚═══════════════════════╝\u001b[0m');
      grid.push('```');

      return grid.join('\n');
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🎨 VERSION CLEAN - AFFICHAGE ALIGNÉ AVEC ESPACES
    // ═══════════════════════════════════════════════════════════════════════
    const createGridEmoji = () => {
      const lines = [];

      // Difficulté badge
      const diffBadge = wordLength === 5 ? '🟢 FACILE' :
                        wordLength === 6 ? '🟡 MOYEN' : '🔴 DIFFICILE';

      // Header simple
      lines.push('');
      lines.push(`✨ **W O R D L E** ✨`);
      lines.push(diffBadge);
      lines.push('');

      // Grille de jeu - UNE SEULE LIGNE par tentative (cases avec lettres dedans)
      for (let i = 0; i < maxAttempts; i++) {
        if (i < attempts.length) {
          // Tentative passée - combiner case et lettre
          const attempt = attempts[i];
          const isWinningRow = attempt.result.every(r => r === '🟩');

          // Cases avec espaces larges entre elles
          const boxes = attempt.result.join('   ');

          // Lettres avec point simple et flèche
          const letters = attempt.word.split('').join(' . ');

          if (isWinningRow) {
            lines.push(`🏆  ${boxes}`);
            lines.push(`    * ${letters}`);
          } else {
            lines.push(`      ${boxes}`);
            lines.push(`    * ${letters}`);
          }
          lines.push('');

        } else if (i === attempts.length) {
          // Ligne de saisie actuelle
          const inputChars = currentInput.padEnd(wordLength, ' ').split('');

          const boxes = inputChars.map((char, idx) => {
            if (char === ' ') return '⬜';
            if (idx === 0 && showFirstLetter) return '🟩';
            return '🔷';
          }).join('   ');

          const letters = inputChars.map(char => char === ' ' ? '_' : char).join(' . ');

          lines.push(`▶     ${boxes}`);
          lines.push(`    * ${letters}`);
          lines.push('');

        } else {
          // Lignes futures vides
          const emptyBoxes = Array(wordLength).fill('⬜').join('   ');
          const emptyLetters = Array(wordLength).fill('_').join(' . ');

          lines.push(`      ${emptyBoxes}`);
          lines.push(`    * ${emptyLetters}`);
          lines.push('');
        }
      }

      return lines.join('\n');
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🌟 BARRE DE VIE PREMIUM
    // ═══════════════════════════════════════════════════════════════════════
    const getHealthBar = () => {
      const remaining = maxAttempts - attempts.length;
      const total = maxAttempts;

      // Barre visuelle avec dégradé
      let bar = '';
      for (let i = 0; i < total; i++) {
        if (i < remaining) {
          // Essais restants - couleur selon nombre
          if (remaining >= 4) bar += '🟩';
          else if (remaining >= 2) bar += '🟨';
          else bar += '🟥';
        } else {
          bar += '⬛';
        }
      }

      // Texte descriptif
      const urgencyText = remaining <= 1 ? '⚠️ **DERNIER ESSAI !**' :
                         remaining <= 2 ? '😰 *Plus que 2 essais...*' :
                         remaining <= 3 ? '🤔 *Réfléchis bien...*' : '';

      return `${bar} **${remaining}/${total}**\n${urgencyText}`;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // ⌨️ CLAVIER ALPHABÉTIQUE INTERACTIF (5 rangées max, 5 boutons max)
    // ═══════════════════════════════════════════════════════════════════════
    const createKeyboard = () => {
      // Layout alphabétique (même structure que le Pendu)
      // 23 lettres (A-W) sur boutons + X, Y, Z accessibles par chat
      const letterRows = [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'G', 'H', 'I', 'J'],
        ['K', 'L', 'M', 'N', 'O'],
        ['P', 'Q', 'R', 'S', 'T']
      ];

      const components = [];

      // 4 premières rangées de lettres (A-T)
      letterRows.forEach(row => {
        const actionRow = new ActionRowBuilder();
        row.forEach(letter => {
          const state = keyboardState[letter];
          let style = ButtonStyle.Secondary;
          let disabled = gameEnded;

          if (state === 'correct') style = ButtonStyle.Success;
          else if (state === 'present') style = ButtonStyle.Primary; // Bleu pour "présent"
          else if (state === 'absent') {
            style = ButtonStyle.Secondary;
            disabled = true; // Désactiver les lettres absentes
          }

          actionRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`wordle_key_${letter}_${progress.id}`)
              .setLabel(letter)
              .setStyle(style)
              .setDisabled(disabled)
          );
        });
        components.push(actionRow);
      });

      // 5ème rangée: U, V, W + boutons d'action (X, Y, Z par chat)
      const actionRow5 = new ActionRowBuilder();
      ['U', 'V', 'W'].forEach(letter => {
        const state = keyboardState[letter];
        let style = ButtonStyle.Secondary;
        let disabled = gameEnded;

        if (state === 'correct') style = ButtonStyle.Success;
        else if (state === 'present') style = ButtonStyle.Primary;
        else if (state === 'absent') {
          style = ButtonStyle.Secondary;
          disabled = true;
        }

        actionRow5.addComponents(
          new ButtonBuilder()
            .setCustomId(`wordle_key_${letter}_${progress.id}`)
            .setLabel(letter)
            .setStyle(style)
            .setDisabled(disabled)
        );
      });

      // Bouton Supprimer (⌫)
      actionRow5.addComponents(
        new ButtonBuilder()
          .setCustomId(`wordle_delete_${progress.id}`)
          .setLabel('⌫')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(gameEnded || currentInput.length === 0 || (showFirstLetter && currentInput.length === 1))
      );

      // Bouton Valider (✓)
      actionRow5.addComponents(
        new ButtonBuilder()
          .setCustomId(`wordle_submit_${progress.id}`)
          .setLabel('✓')
          .setStyle(ButtonStyle.Success)
          .setDisabled(gameEnded || currentInput.length !== wordLength)
      );

      components.push(actionRow5);

      return components;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 VÉRIFICATION D'UN MOT
    // ═══════════════════════════════════════════════════════════════════════
    const checkWord = (guessWord) => {
      const guess = guessWord.toUpperCase();
      const secret = secretWord.split('');
      const result = Array(wordLength).fill('⬛');
      const secretCopy = [...secret];

      // Premier passage: trouver les lettres à la bonne position (🟩)
      for (let i = 0; i < wordLength; i++) {
        if (guess[i] === secret[i]) {
          result[i] = '🟩';
          secretCopy[i] = null; // Marquer comme utilisé
          keyboardState[guess[i]] = 'correct';
        }
      }

      // Deuxième passage: trouver les lettres présentes ailleurs (🟨)
      for (let i = 0; i < wordLength; i++) {
        if (result[i] === '🟩') continue;

        const letterIndex = secretCopy.indexOf(guess[i]);
        if (letterIndex !== -1) {
          result[i] = '🟨';
          secretCopy[letterIndex] = null;
          if (keyboardState[guess[i]] !== 'correct') {
            keyboardState[guess[i]] = 'present';
          }
        } else {
          // Lettre absente
          if (keyboardState[guess[i]] === 'unused') {
            keyboardState[guess[i]] = 'absent';
          }
        }
      }

      return result;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // ⭐ SYSTÈME D'ÉTOILES
    // ═══════════════════════════════════════════════════════════════════════
    const getStarRating = (attemptCount) => {
      if (attemptCount === 1) return '⭐⭐⭐⭐⭐ GÉNIE !';
      if (attemptCount === 2) return '⭐⭐⭐⭐ EXTRAORDINAIRE !';
      if (attemptCount === 3) return '⭐⭐⭐ EXCELLENT !';
      if (attemptCount === 4) return '⭐⭐ TRÈS BIEN !';
      if (attemptCount === 5) return '⭐ BIEN JOUÉ !';
      return '😅 DE JUSTESSE !';
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 📊 STATISTIQUES DE FIN
    // ═══════════════════════════════════════════════════════════════════════
    const getStatsBlock = (success, attemptCount) => {
      const bars = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
      let stats = '';

      for (let i = 0; i < maxAttempts; i++) {
        const isCurrentAttempt = success && attemptCount === i + 1;
        const bar = isCurrentAttempt ? '🟩'.repeat(8) : '⬜'.repeat(8);
        stats += `${bars[i]} ${bar}\n`;
      }

      return stats;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🎮 CRÉATION DE L'EMBED PRINCIPAL - VERSION PREMIUM
    // ═══════════════════════════════════════════════════════════════════════
    const createGameEmbed = (statusMessage = null) => {
      const remainingAttempts = maxAttempts - attempts.length;

      // Gradient de couleur dynamique selon l'urgence
      let color = '#3498DB'; // Bleu par défaut
      let moodEmoji = '🎯';

      if (remainingAttempts <= 1) {
        color = '#E74C3C'; // Rouge critique
        moodEmoji = '😱';
      } else if (remainingAttempts <= 2) {
        color = '#E67E22'; // Orange
        moodEmoji = '😰';
      } else if (remainingAttempts <= 3) {
        color = '#F1C40F'; // Jaune
        moodEmoji = '🤔';
      } else if (remainingAttempts <= 4) {
        color = '#2ECC71'; // Vert
        moodEmoji = '😊';
      }

      // Légende des couleurs
      const legend = `\n> 🟩 = Bonne lettre, bonne place\n> 🟨 = Bonne lettre, mauvaise place\n> ⬛ = Lettre absente`;

      const embed = new EmbedBuilder()
        .setTitle(`${moodEmoji} W O R D L E ${moodEmoji}`)
        .setColor(color)
        .setDescription(
          createGridEmoji() + '\n' +
          `\n${getHealthBar()}\n` +
          (statusMessage ? `\n${statusMessage}\n` : '') +
          (hint ? `\n💡 **Indice:** ||${hint}||\n` : '') +
          legend
        )
        .addFields(
          {
            name: `${diffEmoji} ${diffLabel}`,
            value: `**${wordLength} lettres** • ${maxAttempts} essais`,
            inline: true
          },
          {
            name: '⌨️ Comment jouer',
            value: `• Clique sur les lettres du clavier\n• Ou tape un mot de ${wordLength} lettres dans le chat\n• *(X, Y, Z au clavier uniquement)*`,
            inline: true
          }
        );

      const timeLeft = Math.round(timeout / 1000);
      embed.setFooter({
        text: `⏱️ ${timeLeft}s • Essai ${attempts.length + 1}/${maxAttempts} • Lettres trouvées: ${Object.values(keyboardState).filter(s => s === 'correct').length}`
      });

      // Image de fond thématique
      embed.setThumbnail('https://em-content.zobj.net/source/apple/391/green-square_1f7e9.png');

      return embed;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🎊 EMBED DE VICTOIRE - VERSION SPECTACULAIRE
    // ═══════════════════════════════════════════════════════════════════════
    const createVictoryEmbed = () => {
      const attemptCount = attempts.length;
      const rating = getStarRating(attemptCount);

      // Grille finale avec les lettres révélées
      let finalGrid = attempts.map((a, idx) => {
        const isWinning = idx === attempts.length - 1;
        const prefix = isWinning ? '🏆' : '　';
        return `${prefix} ${a.result.join('')} ${a.word.split('').map(l => `**${l}**`).join(' ')}`;
      }).join('\n');

      // Effets visuels selon performance
      let celebrationBanner;
      let titleEmoji;
      if (attemptCount === 1) {
        celebrationBanner = '🌟✨🌟✨🌟✨🌟✨🌟✨🌟✨🌟';
        titleEmoji = '👑';
      } else if (attemptCount <= 2) {
        celebrationBanner = '🎆🎇🎆🎇🎆🎇🎆🎇🎆';
        titleEmoji = '🏆';
      } else if (attemptCount <= 4) {
        celebrationBanner = '🎉🎊🎉🎊🎉🎊🎉🎊🎉';
        titleEmoji = '🎉';
      } else {
        celebrationBanner = '✅🟩✅🟩✅🟩✅🟩✅';
        titleEmoji = '✅';
      }

      const embed = new EmbedBuilder()
        .setTitle(`${titleEmoji} VICTOIRE ! ${titleEmoji}`)
        .setColor(attemptCount <= 2 ? '#FFD700' : attemptCount <= 4 ? '#2ECC71' : '#27AE60')
        .setDescription(
          `${celebrationBanner}\n\n` +
          `## ${rating}\n\n` +
          `🎯 **Le mot était:**\n` +
          `\`\`\`fix\n${secretWord}\n\`\`\`\n` +
          `**📜 Ton parcours:**\n${finalGrid}\n\n` +
          `📊 **Distribution:**\n${getStatsBlock(true, attemptCount)}\n` +
          `${celebrationBanner}`
        )
        .addFields(
          { name: '🎯 Performance', value: `${attemptCount}/${maxAttempts} essais`, inline: true },
          { name: '💯 Score', value: `${Math.round((1 - (attemptCount - 1) / maxAttempts) * 100)}%`, inline: true }
        )
        .setThumbnail('https://em-content.zobj.net/source/apple/391/trophy_1f3c6.png')
        .setFooter({ text: '🎮 Wordle • Félicitations !' });

      return embed;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 💀 EMBED DE DÉFAITE - VERSION DRAMATIQUE
    // ═══════════════════════════════════════════════════════════════════════
    const createDefeatEmbed = () => {
      // Grille finale avec les lettres révélées
      let finalGrid = attempts.map(a => {
        return `　 ${a.result.join('')} ${a.word.split('').map(l => `**${l}**`).join(' ')}`;
      }).join('\n');

      // Révélation dramatique du mot
      const secretReveal = secretWord.split('').map(l => `🟩**${l}**`).join(' ');

      const embed = new EmbedBuilder()
        .setTitle('💀 GAME OVER 💀')
        .setColor('#8B0000')
        .setDescription(
          `⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n\n` +
          `😔 **Si proche et pourtant si loin...**\n\n` +
          `🔮 **Le mot secret était:**\n` +
          `\`\`\`diff\n- ${secretWord}\n\`\`\`\n` +
          `${secretReveal}\n\n` +
          `**📜 Tes tentatives:**\n${finalGrid}\n\n` +
          `📊 **Distribution:**\n${getStatsBlock(false, 0)}\n` +
          `⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛`
        )
        .addFields(
          { name: '🎯 Tentatives', value: `${attempts.length}/${maxAttempts}`, inline: true },
          { name: '📝 Conseil', value: 'Commence par des mots avec beaucoup de voyelles !', inline: true }
        )
        .setThumbnail('https://em-content.zobj.net/source/apple/391/skull_1f480.png')
        .setFooter({ text: '🎮 Wordle • Réessaye, tu peux y arriver !' });

      return embed;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 📤 ENVOI DU MESSAGE INITIAL
    // ═══════════════════════════════════════════════════════════════════════
    gameMessage = await interaction.channel.send({
      embeds: [createGameEmbed()],
      components: createKeyboard()
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 🎮 COLLECTEURS D'INTERACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    const buttonFilter = i =>
      i.user.id === interaction.user.id &&
      (i.customId.startsWith('wordle_key_') ||
       i.customId.startsWith('wordle_delete_') ||
       i.customId.startsWith('wordle_submit_'));

    const messageFilter = m =>
      m.author.id === interaction.user.id;

    const buttonCollector = interaction.channel.createMessageComponentCollector({
      filter: buttonFilter,
      time: timeout
    });

    const messageCollector = interaction.channel.createMessageCollector({
      filter: messageFilter,
      time: timeout
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ⌨️ GESTION DES BOUTONS
    // ═══════════════════════════════════════════════════════════════════════
    buttonCollector.on('collect', async (i) => {
      if (gameEnded) {
        await i.deferUpdate().catch(() => {});
        return;
      }

      const customId = i.customId;

      // Bouton lettre
      if (customId.startsWith('wordle_key_')) {
        const letter = customId.split('_')[2];

        // Ne pas dépasser 5 lettres
        if (currentInput.length < wordLength) {
          currentInput += letter;
          console.log(`⌨️ [Wordle] Lettre ajoutée: ${letter} → "${currentInput}"`);
        }

        await i.update({
          embeds: [createGameEmbed()],
          components: createKeyboard()
        }).catch(() => {});
      }

      // Bouton supprimer
      else if (customId.startsWith('wordle_delete_')) {
        // Si première lettre révélée, ne pas supprimer la première lettre
        const minLength = showFirstLetter ? 1 : 0;
        if (currentInput.length > minLength) {
          currentInput = currentInput.slice(0, -1);
          console.log(`⌫ [Wordle] Lettre supprimée → "${currentInput}"`);
        }

        await i.update({
          embeds: [createGameEmbed()],
          components: createKeyboard()
        }).catch(() => {});
      }

      // Bouton valider
      else if (customId.startsWith('wordle_submit_')) {
        await processSubmission(i);
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 📝 GESTION DES MESSAGES TEXTE
    // ═══════════════════════════════════════════════════════════════════════
    messageCollector.on('collect', async (message) => {
      if (gameEnded) return;

      const input = message.content.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      // Supprimer le message
      try { await message.delete(); } catch (e) {}

      // Une seule lettre: ajouter à la saisie
      if (input.length === 1 && /^[A-Z]$/.test(input)) {
        if (currentInput.length < wordLength) {
          currentInput += input;
          console.log(`📝 [Wordle] Lettre tapée: ${input} → "${currentInput}"`);

          await gameMessage.edit({
            embeds: [createGameEmbed()],
            components: createKeyboard()
          }).catch(() => {});
        }
        return;
      }

      // Mot de 5 lettres: soumettre directement
      if (input.length === wordLength && /^[A-Z]+$/.test(input)) {
        currentInput = input;
        await processSubmission(null);
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // ✅ TRAITEMENT DE LA SOUMISSION
    // ═══════════════════════════════════════════════════════════════════════
    const processSubmission = async (buttonInteraction) => {
      if (currentInput.length !== wordLength) {
        if (buttonInteraction) {
          await buttonInteraction.update({
            embeds: [createGameEmbed(`⚠️ Le mot doit faire ${wordLength} lettres !`)],
            components: createKeyboard()
          }).catch(() => {});
        }
        return;
      }

      // Vérifier le mot
      const guess = currentInput;
      const result = checkWord(guess);

      attempts.push({ word: guess, result });
      console.log(`🎯 [Wordle] Tentative ${attempts.length}: "${guess}" → ${result.join('')}`);

      // Victoire ?
      if (result.every(r => r === '🟩')) {
        gameEnded = true;
        buttonCollector.stop('victory');
        messageCollector.stop('victory');
        return;
      }

      // Défaite ?
      if (attempts.length >= maxAttempts) {
        gameEnded = true;
        buttonCollector.stop('defeat');
        messageCollector.stop('defeat');
        return;
      }

      // Continuer - reset saisie (garder première lettre si option activée)
      currentInput = showFirstLetter ? secretWord[0] : '';

      if (buttonInteraction) {
        await buttonInteraction.update({
          embeds: [createGameEmbed()],
          components: createKeyboard()
        }).catch(() => {});
      } else {
        await gameMessage.edit({
          embeds: [createGameEmbed()],
          components: createKeyboard()
        }).catch(() => {});
      }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 🏁 GESTION DE FIN DE PARTIE
    // ═══════════════════════════════════════════════════════════════════════
    const handleGameEnd = async (reason) => {
      gameEnded = true;

      // Désactiver le clavier
      try {
        await gameMessage.edit({
          embeds: [gameMessage.embeds[0]],
          components: []
        });
      } catch (e) {}

      if (reason === 'victory') {
        console.log(`✅ [Wordle] Victoire en ${attempts.length} essai(s) !`);

        // Sauvegarder le game_state (le status sera mis à jour par completeMission)
        await db.query(
          `UPDATE mission_progress SET game_state = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({
            secretWord,
            attempts: attempts.map(a => ({ word: a.word, result: a.result })),
            success: true,
            attemptCount: attempts.length
          }), progress.id]
        );

        await interaction.channel.send({ embeds: [createVictoryEmbed()] });

        // Utiliser completeMission qui gère : status, récompense, annonce, badges, archivage
        await this.completeMission(interaction, mission, player, progress, null);

      } else if (reason === 'defeat') {
        console.log(`❌ [Wordle] Défaite - le mot était "${secretWord}"`);

        await db.query(
          `UPDATE mission_progress SET game_state = $1, status = 'failed', updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({
            secretWord,
            attempts: attempts.map(a => ({ word: a.word, result: a.result })),
            success: false,
            reason: 'out_of_attempts'
          }), progress.id]
        );

        await interaction.channel.send({ embeds: [createDefeatEmbed()] });

        await announcements.announceMissionFailed(
          interaction.client,
          guildId,
          interaction.user.username,
          mission.name,
          'Plus d\'essais'
        );

        setTimeout(async () => {
          try {
            await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
            await interaction.channel.setArchived(true);
          } catch (error) { console.warn('⚠️ Impossible d\'archiver le thread'); }
        }, 5000);

      } else {
        // Timeout
        console.log(`⏰ [Wordle] Timeout après ${attempts.length} essai(s)`);

        await db.query(
          `UPDATE mission_progress SET game_state = $1, status = 'failed', updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({
            secretWord,
            attempts: attempts.map(a => ({ word: a.word, result: a.result })),
            success: false,
            reason: 'timeout'
          }), progress.id]
        );

        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏰ Temps écoulé !')
          .setColor('#E74C3C')
          .setDescription(
            `Le mot était: **${secretWord}**\n\n` +
            `Tu avais fait ${attempts.length} essai${attempts.length > 1 ? 's' : ''}.`
          )
          .setFooter({ text: 'Le thread se ferme dans 5 secondes...' });

        await interaction.channel.send({ embeds: [timeoutEmbed] });

        await announcements.announceMissionFailed(
          interaction.client,
          guildId,
          interaction.user.username,
          mission.name,
          'Temps écoulé'
        );

        setTimeout(async () => {
          try {
            await this.cleanupTempPermissionByThread(interaction.client, interaction.channel.id, interaction.guildId);
            await interaction.channel.setArchived(true);
          } catch (error) { console.warn('⚠️ Impossible d\'archiver le thread'); }
        }, 5000);
      }
    };

    buttonCollector.on('end', (_, reason) => {
      if (reason !== 'victory' && reason !== 'defeat') {
        messageCollector.stop(reason);
      }
      handleGameEnd(reason);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 ADMIN PANEL WORDLE - GESTION DES MOTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Afficher la liste des mots Wordle configurés
   */
  async handleWordleWordsManagement(interaction, page = 0) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    return this._displayWordleWordsList(interaction, guildId, missionId, page);
  }

  /**
   * Afficher la liste paginée des mots Wordle
   */
  async _displayWordleWordsList(interaction, guildId, missionId, page = 0) {
    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({ content: '❌ Aucun thème actif.', embeds: [], components: [] });
    }

    // Récupérer les mots
    const allWords = await db.queryAll(
      `SELECT * FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3 ORDER BY created_at DESC`,
      [guildId, missionId, theme.id]
    );

    const itemsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(allWords.length / itemsPerPage));
    const currentPage = Math.min(page, totalPages - 1);
    const pageWords = allWords.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

    // Construire l'embed
    let wordsList = pageWords.length > 0
      ? pageWords.map((w, idx) => {
          const wordUpper = w.correct_answer?.toUpperCase() || '???';
          const hintPart = w.hint ? ` - *${w.hint.substring(0, 30)}*` : '';
          return `\`${currentPage * itemsPerPage + idx + 1}.\` **${wordUpper}**${hintPart}`;
        }).join('\n')
      : '*Aucun mot configuré*';

    const embed = new EmbedBuilder()
      .setTitle('🟩 Mots Wordle')
      .setDescription(
        `📊 **${allWords.length}** mot(s) configuré(s)\n` +
        `📝 *Les mots doivent faire exactement 5 lettres*\n\n` +
        wordsList
      )
      .setColor('#2ECC71')
      .setFooter({ text: `Page ${currentPage + 1}/${totalPages} • Thème: ${theme.name}` });

    // Boutons de navigation et actions
    const navRow = new ActionRowBuilder();

    // Bouton page précédente
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`wordle_words_page_${missionId}_${currentPage - 1}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0)
    );

    // Bouton ajouter
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`wordle_word_add_${missionId}`)
        .setLabel('➕ Ajouter')
        .setStyle(ButtonStyle.Success)
    );

    // Bouton supprimer
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`wordle_word_delete_select_${missionId}`)
        .setLabel('🗑️ Supprimer')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(allWords.length === 0)
    );

    // Bouton page suivante
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`wordle_words_page_${missionId}_${currentPage + 1}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1)
    );

    // Bouton retour
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`select_mission_${missionId}`)
        .setLabel('🔙 Retour à la mission')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [navRow, backRow]
    });
  }

  /**
   * Navigation entre les pages de la liste des mots Wordle
   */
  async handleWordleWordsPage(interaction) {
    await interaction.deferUpdate();

    // customId: wordle_words_page_123_0
    const parts = interaction.customId.split('_');
    const page = parseInt(parts.pop());
    const missionId = parseInt(parts.pop());
    const guildId = interaction.guildId;

    return this._displayWordleWordsList(interaction, guildId, missionId, page);
  }

  /**
   * Ajouter un mot Wordle - Flow interactif
   * Étape 1: Choisir la difficulté (détermine la longueur du mot)
   *   - Facile = 5 lettres
   *   - Moyen = 6 lettres
   *   - Difficile = 7 lettres
   * Étape 2: Saisir le mot (selon la longueur de la difficulté)
   * Étape 3: Saisir un indice (optionnel)
   */
  async handleWordleWordAdd(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({ content: '❌ Aucun thème actif.', embeds: [], components: [] });
    }

    // Récupérer la config des essais par difficulté
    const mission = await db.queryOne(
      `SELECT validation_data FROM missions WHERE id = $1 AND guild_id = $2`,
      [missionId, guildId]
    );
    let validationData = mission?.validation_data || {};
    if (typeof validationData === 'string') {
      try { validationData = JSON.parse(validationData); } catch (e) { validationData = {}; }
    }

    // Défauts logiques: plus c'est difficile, moins d'essais
    const easyAttempts = validationData.easy_attempts || 8;    // Facile = 8 essais
    const mediumAttempts = validationData.medium_attempts || 6; // Moyen = 6 essais
    const hardAttempts = validationData.hard_attempts || 4;    // Difficile = 4 essais

    // Étape 1: Choisir la difficulté
    const step1Embed = new EmbedBuilder()
      .setTitle('🟩 Ajouter un Mot Wordle - Étape 1/3')
      .setDescription(
        '**Choisis la difficulté du mot :**\n\n' +
        `🟢 **Facile** = **5 lettres** (${easyAttempts} essais)\n` +
        `🟡 **Moyen** = **6 lettres** (${mediumAttempts} essais)\n` +
        `🔴 **Difficile** = **7 lettres** (${hardAttempts} essais)\n\n` +
        '💡 La difficulté détermine le nombre de lettres que le mot doit avoir.'
      )
      .setColor('#2ECC71')
      .setFooter({ text: 'Clique sur un bouton pour choisir' });

    const difficultyButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wordle_diff_easy_${missionId}`)
        .setLabel('🟢 Facile (5 lettres)')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`wordle_diff_medium_${missionId}`)
        .setLabel('🟡 Moyen (6 lettres)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`wordle_diff_hard_${missionId}`)
        .setLabel('🔴 Difficile (7 lettres)')
        .setStyle(ButtonStyle.Danger)
    );

    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wordle_add_cancel_${missionId}`)
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '',
      embeds: [step1Embed],
      components: [difficultyButtons, cancelRow]
    });

    // Collecter le choix de difficulté
    const diffCollector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id &&
        (i.customId.startsWith('wordle_diff_') || i.customId.startsWith('wordle_add_cancel_')),
      time: 60000,
      max: 1
    });

    diffCollector.on('collect', async (diffInteraction) => {
      await diffInteraction.deferUpdate();

      // Annulation
      if (diffInteraction.customId.startsWith('wordle_add_cancel_')) {
        return this._displayWordleWordsList(diffInteraction, guildId, missionId, 0);
      }

      const difficulty = diffInteraction.customId.includes('_easy_') ? 'easy' :
                        diffInteraction.customId.includes('_hard_') ? 'hard' : 'medium';

      // Longueur du mot selon la difficulté
      const wordLength = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 7 : 6;
      const diffEmoji = difficulty === 'easy' ? '🟢' : difficulty === 'hard' ? '🔴' : '🟡';
      const diffLabel = difficulty === 'easy' ? 'Facile' : difficulty === 'hard' ? 'Difficile' : 'Moyen';

      // Étape 2: Demander le mot avec la bonne longueur
      const step2Embed = new EmbedBuilder()
        .setTitle('🟩 Ajouter un Mot Wordle - Étape 2/3')
        .setDescription(
          `${diffEmoji} Difficulté : **${diffLabel}**\n\n` +
          `**Envoie le mot à ajouter** (exactement **${wordLength} lettres**)\n\n` +
          `💡 Ex: ${wordLength === 5 ? '`PIANO`, `MAGIE`, `LIVRE`' :
                   wordLength === 6 ? '`BALLON`, `CHEVAL`, `JARDIN`' :
                   '`CHATEAU`, `PORTAIL`, `GRIFFON`'}\n\n` +
          '⏱️ Tu as 2 minutes pour répondre.'
        )
        .setColor('#F39C12')
        .setFooter({ text: 'Tape "annuler" pour annuler' });

      await interaction.editReply({
        content: '',
        embeds: [step2Embed],
        components: []
      });

      const filter = m => m.author.id === interaction.user.id;

      try {
        const wordCollected = await interaction.channel.awaitMessages({
          filter,
          max: 1,
          time: 120000,
          errors: ['time']
        });

        const wordInput = wordCollected.first().content.trim();
        try { await wordCollected.first().delete(); } catch (e) {}

        if (wordInput.toLowerCase() === 'annuler') {
          return this._displayWordleWordsList(interaction, guildId, missionId, 0);
        }

        // Normaliser et valider le mot
        const word = wordInput.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cleanWord = word.replace(/[^A-Z]/g, '');

        // Vérifier la longueur selon la difficulté
        if (cleanWord.length !== wordLength) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setTitle('❌ Mot invalide')
              .setDescription(
                `${diffEmoji} **${diffLabel}** nécessite exactement **${wordLength} lettres**.\n\n` +
                `"${word}" a **${cleanWord.length}** lettre(s).`
              )
              .setColor('#E74C3C')
            ]
          });
          await this.sleep(2000);
          return this._displayWordleWordsList(interaction, guildId, missionId, 0);
        }

        // Vérifier si le mot existe déjà
        const existingWord = await db.queryOne(
          `SELECT id FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3 AND UPPER(correct_answer) = $4`,
          [guildId, missionId, theme.id, cleanWord]
        );

        if (existingWord) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setTitle('❌ Mot déjà existant')
              .setDescription(`Le mot **${cleanWord}** existe déjà dans cette mission.`)
              .setColor('#E74C3C')
            ]
          });
          await this.sleep(2000);
          return this._displayWordleWordsList(interaction, guildId, missionId, 0);
        }

        // Étape 3: Demander un indice
        const step3Embed = new EmbedBuilder()
          .setTitle('🟩 Ajouter un Mot Wordle - Étape 3/3')
          .setDescription(
            `${diffEmoji} Difficulté : **${diffLabel}**\n` +
            `✅ Mot : **${cleanWord}** (${wordLength} lettres)\n\n` +
            '**Envoie un indice** pour aider les joueurs (optionnel).\n\n' +
            '💡 Ex: "Instrument de musique", "Animal magique", etc.\n\n' +
            '⏱️ Tu as 2 minutes. Tape **"aucun"** pour ne pas mettre d\'indice.'
          )
          .setColor('#9B59B6')
          .setFooter({ text: 'Tape "annuler" pour annuler' });

        await interaction.editReply({
          content: '',
          embeds: [step3Embed],
          components: []
        });

        const hintCollected = await interaction.channel.awaitMessages({
          filter,
          max: 1,
          time: 120000,
          errors: ['time']
        });

        const hintInput = hintCollected.first().content.trim();
        try { await hintCollected.first().delete(); } catch (e) {}

        if (hintInput.toLowerCase() === 'annuler') {
          return this._displayWordleWordsList(interaction, guildId, missionId, 0);
        }

        const hint = hintInput.toLowerCase() === 'aucun' ? null : hintInput.substring(0, 100);

        // Sauvegarder le mot dans quiz_questions
        await db.query(
          `INSERT INTO quiz_questions (guild_id, theme_id, mission_id, question_text, correct_answer, hint, difficulty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [guildId, theme.id, missionId, `Wordle: ${cleanWord}`, cleanWord, hint, difficulty]
        );

        // Mettre à jour validation_data avec le compteur de mots
        const wordsCount = await db.queryOne(
          `SELECT COUNT(*) as count FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3`,
          [guildId, missionId, theme.id]
        );

        await db.query(
          `UPDATE missions SET validation_data = validation_data || $1::jsonb WHERE id = $2 AND guild_id = $3`,
          [JSON.stringify({ words_count: parseInt(wordsCount.count) }), missionId, guildId]
        );

        console.log(`✅ [Wordle] Mot "${cleanWord}" (${difficulty}, ${wordLength} lettres) ajouté à la mission #${missionId}`);

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Mot Wordle Ajouté !')
          .setDescription(
            `${diffEmoji} **${cleanWord}** (${wordLength} lettres - ${diffLabel})\n` +
            `${hint ? `💡 Indice: ${hint}\n` : ''}` +
            `📊 Total: **${wordsCount.count}** mot(s)`
          )
          .setColor('#2ECC71');

        await interaction.editReply({
          embeds: [successEmbed],
          components: []
        });

        // Retourner à la liste après 2 secondes
        await this.sleep(2000);
        return this._displayWordleWordsList(interaction, guildId, missionId, 0);

      } catch (error) {
        console.error('❌ Erreur lors de l\'ajout du mot wordle:', error);
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('⏱️ Temps écoulé')
            .setDescription('La création du mot a été annulée.')
            .setColor('#E74C3C')
          ],
          components: []
        });
        await this.sleep(2000);
        return this._displayWordleWordsList(interaction, guildId, missionId, 0);
      }
    });

    diffCollector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setTitle('⏱️ Temps écoulé')
            .setDescription('La création du mot a été annulée.')
            .setColor('#E74C3C')
          ],
          components: []
        });
        await this.sleep(2000);
        return this._displayWordleWordsList(interaction, guildId, missionId, 0);
      }
    });
  }

  /**
   * Afficher le select pour supprimer un mot Wordle
   */
  async handleWordleWordDeleteSelect(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const theme = await db.getActiveTheme(guildId);
    if (!theme) {
      return interaction.editReply({ content: '❌ Aucun thème actif.', embeds: [], components: [] });
    }

    const words = await db.queryAll(
      `SELECT id, correct_answer, hint FROM quiz_questions
       WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3
       ORDER BY created_at DESC LIMIT 25`,
      [guildId, missionId, theme.id]
    );

    if (words.length === 0) {
      return interaction.editReply({
        content: '❌ Aucun mot à supprimer.',
        embeds: [],
        components: []
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_wordle_delete_${missionId}`)
      .setPlaceholder('Sélectionne un mot à supprimer')
      .addOptions(words.map(w => ({
        label: w.correct_answer?.toUpperCase() || '???',
        value: w.id.toString(),
        description: w.hint ? w.hint.substring(0, 50) : 'Aucun indice'
      })));

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Supprimer un mot Wordle')
      .setDescription('Sélectionne le mot que tu veux supprimer.')
      .setColor('#E74C3C');

    const cancelButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_wordle_words_${missionId}`)
        .setLabel('🔙 Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        cancelButton
      ]
    });
  }

  /**
   * Supprimer un mot Wordle après sélection
   */
  async handleWordleWordDelete(interaction) {
    await interaction.deferReply({ flags: 64 });

    const wordId = parseInt(interaction.values[0]);
    const guildId = interaction.guildId;
    const missionId = parseInt(interaction.customId.split('_').pop());

    // Récupérer le mot avant suppression
    const word = await db.queryOne(
      'SELECT correct_answer FROM quiz_questions WHERE id = $1 AND guild_id = $2',
      [wordId, guildId]
    );

    // Supprimer
    await db.query(
      'DELETE FROM quiz_questions WHERE id = $1 AND guild_id = $2',
      [wordId, guildId]
    );

    console.log(`🗑️ [Wordle] Mot "${word?.correct_answer}" #${wordId} supprimé`);

    // Mettre à jour le compteur
    const count = await db.queryOne(
      `SELECT COUNT(*) as count FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2`,
      [guildId, missionId]
    );

    await db.query(
      `UPDATE missions SET validation_data = validation_data || $1::jsonb WHERE id = $2 AND guild_id = $3`,
      [JSON.stringify({ words_count: parseInt(count.count) }), missionId, guildId]
    );

    await interaction.editReply({
      content: `✅ Mot **${word?.correct_answer?.toUpperCase() || ''}** supprimé !`
    });

    // Retourner à la liste
    const fakeInteraction = {
      ...interaction,
      customId: `mission_wordle_words_${missionId}`,
      deferUpdate: async () => {},
      editReply: interaction.message.edit.bind(interaction.message)
    };

    return this._displayWordleWordsList(fakeInteraction, guildId, missionId, 0);
  }

  /**
   * Toggle l'option "première lettre révélée" pour Wordle
   */
  async handleWordleFirstLetterToggle(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const mission = await db.queryOne(
      'SELECT * FROM missions WHERE id = $1 AND guild_id = $2',
      [missionId, guildId]
    );

    if (!mission) {
      return interaction.editReply({ content: '❌ Mission introuvable.', embeds: [], components: [] });
    }

    let validationData = mission.validation_data;
    if (typeof validationData === 'string') {
      try { validationData = JSON.parse(validationData); } catch (e) { validationData = {}; }
    }
    validationData = validationData || {};

    const newValue = !validationData.show_first_letter;
    validationData.show_first_letter = newValue;

    await db.query(
      `UPDATE missions SET validation_data = $1 WHERE id = $2 AND guild_id = $3`,
      [JSON.stringify(validationData), missionId, guildId]
    );

    console.log(`🔤 [Wordle] Mission #${missionId} - 1ère lettre: ${newValue ? 'révélée' : 'cachée'}`);

    // Rafraîchir la vue de la mission
    const adminPanelHandler = require('./adminPanelHandler');
    const modifiedInteraction = Object.create(interaction);
    modifiedInteraction.customId = `select_mission_${missionId}`;
    modifiedInteraction.values = null;
    modifiedInteraction.deferUpdate = async () => {};

    return adminPanelHandler.handleMissionSelection(modifiedInteraction);
  }

  /**
   * Configurer le nombre d'essais PAR DIFFICULTÉ pour une mission Wordle
   * - Facile (5 lettres): easy_attempts
   * - Moyen (6 lettres): medium_attempts
   * - Difficile (7 lettres): hard_attempts
   */
  async handleWordleAttemptsConfig(interaction) {
    await interaction.deferUpdate();

    const missionId = parseInt(interaction.customId.split('_').pop());
    const guildId = interaction.guildId;

    const mission = await db.queryOne(
      'SELECT * FROM missions WHERE id = $1 AND guild_id = $2',
      [missionId, guildId]
    );

    if (!mission) {
      return interaction.editReply({ content: '❌ Mission introuvable.', embeds: [], components: [] });
    }

    let validationData = mission.validation_data;
    if (typeof validationData === 'string') {
      try { validationData = JSON.parse(validationData); } catch (e) { validationData = {}; }
    }
    validationData = validationData || {};

    // Défauts logiques: plus c'est difficile, moins d'essais
    const easyAttempts = validationData.easy_attempts || 8;    // Facile = 8 essais
    const mediumAttempts = validationData.medium_attempts || 6; // Moyen = 6 essais
    const hardAttempts = validationData.hard_attempts || 4;    // Difficile = 4 essais

    // Afficher le menu de sélection de difficulté
    const embed = new EmbedBuilder()
      .setTitle('🎯 Configurer les essais par difficulté')
      .setDescription(
        '**Chaque difficulté a son propre nombre d\'essais:**\n\n' +
        `🟢 **Facile** (5 lettres) : **${easyAttempts}** essais\n` +
        `🟡 **Moyen** (6 lettres) : **${mediumAttempts}** essais\n` +
        `🔴 **Difficile** (7 lettres) : **${hardAttempts}** essais\n\n` +
        '*Clique sur une difficulté pour modifier le nombre d\'essais.*'
      )
      .setColor('#9B59B6');

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wordle_cfg_easy_${missionId}`)
        .setLabel(`🟢 Facile: ${easyAttempts} essais`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`wordle_cfg_medium_${missionId}`)
        .setLabel(`🟡 Moyen: ${mediumAttempts} essais`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`wordle_cfg_hard_${missionId}`)
        .setLabel(`🔴 Difficile: ${hardAttempts} essais`)
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`select_mission_${missionId}`)
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Afficher les options d'essais pour une difficulté spécifique
   */
  async handleWordleAttemptsDifficultySelect(interaction) {
    await interaction.deferUpdate();

    // customId: wordle_cfg_easy_123 / wordle_cfg_medium_123 / wordle_cfg_hard_123
    const parts = interaction.customId.split('_');
    const missionId = parseInt(parts.pop());
    const difficulty = parts[2]; // easy, medium, hard
    const guildId = interaction.guildId;

    const mission = await db.queryOne(
      'SELECT * FROM missions WHERE id = $1 AND guild_id = $2',
      [missionId, guildId]
    );

    if (!mission) {
      return interaction.editReply({ content: '❌ Mission introuvable.', embeds: [], components: [] });
    }

    let validationData = mission.validation_data;
    if (typeof validationData === 'string') {
      try { validationData = JSON.parse(validationData); } catch (e) { validationData = {}; }
    }
    validationData = validationData || {};

    const currentAttempts = validationData[`${difficulty}_attempts`] || 6;

    const diffEmoji = difficulty === 'easy' ? '🟢' : difficulty === 'hard' ? '🔴' : '🟡';
    const diffLabel = difficulty === 'easy' ? 'Facile (5 lettres)' :
                      difficulty === 'hard' ? 'Difficile (7 lettres)' : 'Moyen (6 lettres)';

    const embed = new EmbedBuilder()
      .setTitle(`${diffEmoji} Essais pour ${diffLabel}`)
      .setDescription(
        `**Valeur actuelle:** ${currentAttempts} essais\n\n` +
        '*Sélectionne le nouveau nombre d\'essais:*'
      )
      .setColor(difficulty === 'easy' ? '#2ECC71' : difficulty === 'hard' ? '#E74C3C' : '#F39C12');

    // Ligne 1: 3, 4, 5, 6, 7
    const row1 = new ActionRowBuilder().addComponents(
      [3, 4, 5, 6, 7].map(n =>
        new ButtonBuilder()
          .setCustomId(`wordle_set_${difficulty}_${missionId}_${n}`)
          .setLabel(`${n}`)
          .setStyle(currentAttempts === n ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    );

    // Ligne 2: 8, 9, 10 + Retour
    const row2 = new ActionRowBuilder().addComponents(
      [8, 9, 10].map(n =>
        new ButtonBuilder()
          .setCustomId(`wordle_set_${difficulty}_${missionId}_${n}`)
          .setLabel(`${n}`)
          .setStyle(currentAttempts === n ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    );

    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`mission_wordle_attempts_${missionId}`)
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '',
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Définir le nombre d'essais pour une difficulté spécifique
   */
  async handleWordleSetAttempts(interaction) {
    await interaction.deferUpdate();

    // customId: wordle_set_easy_123_6 / wordle_set_medium_123_5 / wordle_set_hard_123_4
    const parts = interaction.customId.split('_');
    const newAttempts = parseInt(parts.pop());
    const missionId = parseInt(parts.pop());
    const difficulty = parts[2]; // easy, medium, hard
    const guildId = interaction.guildId;

    const mission = await db.queryOne(
      'SELECT * FROM missions WHERE id = $1 AND guild_id = $2',
      [missionId, guildId]
    );

    if (!mission) {
      return interaction.editReply({ content: '❌ Mission introuvable.', embeds: [], components: [] });
    }

    let validationData = mission.validation_data;
    if (typeof validationData === 'string') {
      try { validationData = JSON.parse(validationData); } catch (e) { validationData = {}; }
    }
    validationData = validationData || {};

    validationData[`${difficulty}_attempts`] = newAttempts;

    await db.query(
      `UPDATE missions SET validation_data = $1 WHERE id = $2 AND guild_id = $3`,
      [JSON.stringify(validationData), missionId, guildId]
    );

    const diffLabel = difficulty === 'easy' ? 'Facile' : difficulty === 'hard' ? 'Difficile' : 'Moyen';
    console.log(`🎯 [Wordle] Mission #${missionId} - ${diffLabel}: ${newAttempts} essais`);

    // Retourner au menu principal des essais
    const modifiedInteraction = Object.create(interaction);
    modifiedInteraction.customId = `mission_wordle_attempts_${missionId}`;
    modifiedInteraction.deferUpdate = async () => {};

    return this.handleWordleAttemptsConfig(modifiedInteraction);
  }
}

module.exports = new MissionHandler();
