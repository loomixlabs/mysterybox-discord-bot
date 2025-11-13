/**
 * ⚠️ HANDLER DÉPRÉCIÉ - À TERME REMPLACER PAR mysteryBoxHandler
 *
 * Ce handler est conservé uniquement pour compatibilité rétroactive avec
 * d'anciens boutons "give_*" qui pourraient encore exister.
 *
 * NOUVEAU SYSTÈME : Utiliser mysteryBoxHandler pour tous les nouveaux gives
 * Les nouveaux boutons utilisent le format "mystery_open_*"
 */

const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../utils/database-pg');

class GiveHandler {

  // ⚠️ createGive() SUPPRIMÉE - Utiliser mysteryBoxHandler.createMysteryBox() à la place

  /**
   * Gérer le clic sur un bouton give
   */
  async handleGiveClick(interaction) {
    const [, itemType, itemId] = interaction.customId.split('_');
    const userId = interaction.user.id;

    // Désactiver le bouton immédiatement (premier arrivé)
    await interaction.update({
      components: [
        new ActionRowBuilder().addComponents(
          ButtonBuilder.from(interaction.component)
            .setDisabled(true)
            .setLabel('✅ Attribué !')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });

    // Traiter selon le type
    if (itemType === 'collectible') {
      await this.handleCollectibleWin(interaction, parseInt(itemId));
    } else if (itemType === 'trap') {
      await this.handleTrapTrigger(interaction, parseInt(itemId));
    }

    // Logger le gagnant
    await db.updateGiveWinner(
      interaction.guildId,
      interaction.message.id,
      userId,
      interaction.user.username
    );
  }

  /**
   * Attribution d'un collectible
   */
  async handleCollectibleWin(interaction, collectibleId) {
    const userId = interaction.user.id;

    try {
      // Récupérer le collectible avec infos thème
      const collectible = await db.getCollectibleById(interaction.guildId, collectibleId);
      if (!collectible) throw new Error('Collectible introuvable');

      // Créer ou récupérer le joueur
      const player = await db.upsertPlayer(interaction.guildId, userId, interaction.user.username);

      // Vérifier si doublon
      const alreadyHas = await db.hasCollectible(interaction.guildId, player.id, collectibleId);

      if (alreadyHas) {
        return this.sendDuplicateNotification(interaction, collectible);
      }

      // Attribuer le collectible
      await db.addCollectible(interaction.guildId, player.id, collectibleId);

      // Note: Les rôles individuels ne sont PAS attribués pour les collectibles
      // Seul le rôle final du thème est attribué quand la collection est complète
      const guild = interaction.guild;
      const member = await guild.members.fetch(userId);

      // Mettre à jour la progression
      const progress = await db.incrementProgress(interaction.guildId, player.id, collectible.theme_id);

      // Récupérer les messages personnalisés
      const messages = await db.getThemeMessages(interaction.guildId, collectible.theme_id);

      // Message de succès
      const successMsg = (messages.success_message || '✨ Félicitations ! Tu as capturé **{dwarf_name}** !')
        .replace('{dwarf_name}', collectible.name);

      const embed = new EmbedBuilder()
        .setTitle('🎊 Collectible obtenu !')
        .setDescription(successMsg)
        .setColor(collectible.role_color)
        .setThumbnail(collectible.image_url)
        .addFields(
          {
            name: 'Progression',
            value: `${progress.collected_count}/${collectible.required_items}`,
            inline: true
          }
        );

      await interaction.followUp({
        embeds: [embed],
        flags: 64
      });

      // Si mission associée → créer thread
      if (collectible.has_mission) {
        await this.createMissionThread(interaction, player, collectible);
      }

      // Vérifier si collection complète
      if (progress.collected_count >= collectible.required_items) {
        await this.handleCollectionComplete(interaction, player, collectible);
      }

    } catch (error) {
      console.error('🔴 Erreur handleCollectibleWin:', error);
      await interaction.followUp({
        content: '❌ Une erreur est survenue. Contacte un administrateur.',
        flags: 64
      });
    }
  }

  /**
   * Notification de doublon
   */
  async sendDuplicateNotification(interaction, collectible) {
    const messages = await db.getThemeMessages(interaction.guildId, collectible.theme_id);

    const duplicateMsg = (messages.duplicate_message || '⚠️ Tu as déjà **{dwarf_name}** dans ta collection !')
      .replace('{dwarf_name}', collectible.name);

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Doublon !')
      .setDescription(duplicateMsg + '\n\nContinue de chercher les autres !')
      .setColor('#FFA500')
      .setThumbnail(collectible.image_url);

    return interaction.followUp({
      embeds: [embed],
      flags: 64
    });
  }

  /**
   * Gestion des pièges
   */
  async handleTrapTrigger(interaction, trapId) {
    const userId = interaction.user.id;

    try {
      const trap = await db.getTrapById(interaction.guildId, trapId);
      if (!trap) throw new Error('Piège introuvable');

      const player = await db.upsertPlayer(interaction.guildId, userId, interaction.user.username);

      // Calculer l'expiration pour les curses
      const expiresAt = trap.curse_duration
        ? new Date(Date.now() + trap.curse_duration * 60000)
        : null;

      // Logger le piège
      await db.logTrapTriggered(interaction.guildId, player.id, trap.id, expiresAt);

      const embed = new EmbedBuilder()
        .setTitle('😈 OH NON ! C\'était un piège !')
        .setDescription(trap.description)
        .setColor('#8B0000')
        .setImage(trap.image_url);

      // Message visible par tous (pour l'amusement)
      await interaction.followUp({
        embeds: [embed],
        flags: 0
      });

      // Appliquer l'effet selon le type
      switch (trap.type) {
        case 'curse':
          await this.applyCurse(interaction, trap, expiresAt);
          break;
        case 'riddle':
          // TODO: Implémenter énigmes
          break;
        case 'loss':
          // TODO: Implémenter perte d'item
          break;
        // 'fake' ne fait rien de plus
      }

    } catch (error) {
      console.error('🔴 Erreur handleTrapTrigger:', error);
    }
  }

  /**
   * Appliquer une malédiction
   */
  async applyCurse(interaction, trap, expiresAt) {
    if (!trap.curse_role_id) return;

    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const role = guild.roles.cache.get(trap.curse_role_id);

    if (role) {
      await member.roles.add(role);
      console.log(`✅ Malédiction ${role.name} appliquée à ${member.user.username}`);

      // Notifier le joueur
      await interaction.followUp({
        content: `🍎 Tu es maintenant **${role.name}** pendant ${trap.curse_duration} minutes !`,
        flags: 64
      });

      // Retirer après X minutes
      if (trap.curse_duration) {
        setTimeout(async () => {
          try {
            await member.roles.remove(role);
            await member.send('✨ La malédiction est levée ! Tu peux rejouer normalement.');
            console.log(`✅ Malédiction retirée de ${member.user.username}`);
          } catch (error) {
            console.error('🔴 Erreur retrait malédiction:', error);
          }
        }, trap.curse_duration * 60000);
      }
    }
  }

  /**
   * Créer un thread de mission
   */
  async createMissionThread(interaction, player, collectible) {
    try {
      const channel = interaction.channel;

      const thread = await channel.threads.create({
        name: `🎯 Mission - ${interaction.user.username}`,
        autoArchiveDuration: 1440, // 24h
        type: ChannelType.PrivateThread,
        reason: `Mission pour ${collectible.name}`
      });

      // Ajouter le joueur
      await thread.members.add(interaction.user.id);

      // Ajouter les membres avec le rôle co-fondateur
      const coFounderRoleIds = process.env.CO_FOUNDER_ROLE_ID?.split(',') || [];
      if (coFounderRoleIds.length > 0) {
        const guild = interaction.guild;

        for (const roleId of coFounderRoleIds) {
          const trimmedRoleId = roleId.trim();
          const coFounderRole = guild.roles.cache.get(trimmedRoleId);

          if (coFounderRole) {
            // Récupérer tous les membres avec ce rôle
            const membersWithRole = guild.members.cache.filter(member =>
              member.roles.cache.has(trimmedRoleId)
            );

            for (const [memberId, member] of membersWithRole) {
              try {
                await thread.members.add(memberId);
              } catch (e) {
                console.warn(`⚠️  Impossible d'ajouter ${member.user.username} au thread`);
              }
            }
          }
        }
      }

      // Message de mission
      const embed = new EmbedBuilder()
        .setTitle(`🎭 MISSION : ${collectible.name}`)
        .setDescription(collectible.mission_desc || 'Mission à accomplir')
        .setColor(collectible.role_color)
        .addFields(
          { name: 'Type', value: collectible.mission_type || 'manual', inline: true },
          { name: 'Timeout', value: `${collectible.mission_timeout || 30} minutes`, inline: true }
        );

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_submit_${collectible.id}_${player.id}`)
          .setLabel('📤 J\'ai terminé')
          .setStyle(ButtonStyle.Success)
      );

      const roleMentions = coFounderRoleIds.map(id => `<@&${id.trim()}>`).join(' ');
      const mentions = roleMentions
        ? `<@${interaction.user.id}> ${roleMentions}`
        : `<@${interaction.user.id}>`;

      await thread.send({
        content: mentions,
        embeds: [embed],
        components: [buttons]
      });

      // Enregistrer en BDD
      await db.query(
        `INSERT INTO mission_progress (guild_id, player_id, collectible_id, thread_id, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW())`,
        [interaction.guildId, player.id, collectible.id, thread.id]
      );

      // Notifier le joueur
      await interaction.followUp({
        content: `🔒 Un thread privé a été créé pour ta mission : ${thread}`,
        flags: 64
      });

      console.log(`✅ Thread mission créé pour ${player.username}`);

    } catch (error) {
      console.error('🔴 Erreur création thread mission:', error);
    }
  }

  /**
   * Collection complète !
   */
  async handleCollectionComplete(interaction, player, collectible) {
    try {
      const guild = interaction.guild;
      const member = await guild.members.fetch(player.discord_id);

      // Marquer comme complété
      await db.completeCollection(interaction.guildId, player.id, collectible.theme_id);

      // Attribuer le rôle final
      const finalRole = guild.roles.cache.find(r => r.name === collectible.final_role_name);
      if (finalRole) {
        await member.roles.add(finalRole);
        console.log(`✅ Rôle final ${finalRole.name} attribué à ${member.user.username}`);
      }

      // Récupérer les messages personnalisés
      const messages = await db.getThemeMessages(interaction.guildId, collectible.theme_id);

      const completeMsg = messages.complete_message ||
        `**FÉLICITATIONS !** Tu as collecté tous les items du thème **${collectible.theme_name}** !`;

      const embed = new EmbedBuilder()
        .setTitle('👑 COLLECTION COMPLÈTE !')
        .setDescription(completeMsg)
        .setColor(collectible.final_role_color || '#FFD700')
        .addFields(
          { name: 'Rôle obtenu', value: collectible.final_role_name, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL());

      // MP au joueur
      try {
        await member.send({ embeds: [embed] });
      } catch (error) {
        console.warn('⚠️  Impossible d\'envoyer MP à', member.user.username);
      }

      // Annonce publique (optionnelle)
      const announceChannelId = process.env.ANNOUNCE_CHANNEL_ID;
      if (announceChannelId) {
        const announceChannel = guild.channels.cache.get(announceChannelId);
        if (announceChannel) {
          await announceChannel.send({
            content: `🎊 ${member} a complété le thème **${collectible.theme_name}** !`,
            embeds: [embed]
          });
        }
      }

      console.log(`🎉 ${player.username} a complété le thème ${collectible.theme_name} !`);

    } catch (error) {
      console.error('🔴 Erreur handleCollectionComplete:', error);
    }
  }
}

module.exports = new GiveHandler();
