/**
 * Handler pour le système Shame Nickname
 * Surveille les changements de pseudo et restaure le pseudo honteux si le joueur tente de le changer
 * Gère aussi l'expiration automatique des pièges
 */

const db = require('../utils/database-pg');
const cron = require('node-cron');
const badgeHandler = require('./badgeHandler');

class ShameNicknameHandler {
  constructor() {
    this.client = null;
  }

  /**
   * Initialiser le handler avec le client Discord
   */
  init(client) {
    this.client = client;

    // Note: l'événement guildMemberUpdate est maintenant géré par events/guildMemberUpdate.js
    // qui appelle onNicknameChange() quand un pseudo change

    // Cron job pour restaurer les pseudos expirés (toutes les minutes)
    cron.schedule('* * * * *', () => {
      this.cleanupExpiredTraps();
    });

    console.log('🎭 [SHAME] Handler initialisé - Surveillance des pseudos activée');
  }

  /**
   * Callback appelé par l'événement guildMemberUpdate quand un pseudo change
   */
  async onNicknameChange(oldMember, newMember, client) {
    // Stocker le client si pas déjà fait
    if (!this.client && client) {
      this.client = client;
    }

    await this.handleMemberUpdate(oldMember, newMember);
  }

  /**
   * Gérer les changements de membre (pseudo)
   */
  async handleMemberUpdate(oldMember, newMember) {
    // Ne rien faire si le pseudo n'a pas changé
    if (oldMember.nickname === newMember.nickname) return;

    const guildId = newMember.guild.id;

    try {
      // Récupérer le joueur
      const player = await db.queryOne(`
        SELECT id, discord_id FROM players
        WHERE guild_id = $1 AND discord_id = $2
      `, [guildId, newMember.user.id]);

      if (!player) return;

      // Vérifier si le joueur a un piège actif
      const activeTrap = await db.queryOne(`
        SELECT psn.*, t.name as trap_name
        FROM player_shame_nickname psn
        LEFT JOIN traps t ON psn.trap_id = t.id
        WHERE psn.guild_id = $1
          AND psn.player_id = $2
          AND psn.is_active = TRUE
          AND psn.expires_at > NOW()
      `, [guildId, player.id]);

      if (!activeTrap) return;

      // Le joueur a tenté de changer son pseudo alors qu'il est piégé !
      console.log(`🎭 [SHAME] Tentative de changement détectée: ${newMember.user.username} essaie de changer "${activeTrap.shame_nickname}" → "${newMember.nickname}"`);

      // Remettre le pseudo honteux
      try {
        await newMember.setNickname(activeTrap.shame_nickname, 'Piège Shame Nickname - Tentative de changement bloquée');
        console.log(`🎭 [SHAME] Pseudo restauré: ${activeTrap.shame_nickname}`);
      } catch (error) {
        console.error(`🔴 [SHAME] Erreur restauration pseudo:`, error.message);
        return;
      }

      // Incrémenter le compteur de tentatives
      await db.query(`
        UPDATE player_shame_nickname
        SET attempts_to_change = attempts_to_change + 1
        WHERE id = $1
      `, [activeTrap.id]);

      // Logger la tentative dans audit_logs (schéma VPS: admin_id au lieu de actor_id/target_id)
      await db.query(`
        INSERT INTO audit_logs (guild_id, action, admin_id, details)
        VALUES ($1, 'shame_nickname_change_attempt', $2, $3)
      `, [
        guildId,
        newMember.user.id,
        JSON.stringify({
          player_id: player.id,
          attempted_nickname: newMember.nickname,
          restored_nickname: activeTrap.shame_nickname,
          attempts_count: activeTrap.attempts_to_change + 1,
          expires_at: activeTrap.expires_at
        })
      ]);

      // Calculer le temps restant
      const remainingMs = new Date(activeTrap.expires_at) - new Date();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      let remainingText;

      if (remainingMinutes >= 1440) {
        remainingText = `${Math.floor(remainingMinutes / 1440)}j ${Math.floor((remainingMinutes % 1440) / 60)}h`;
      } else if (remainingMinutes >= 60) {
        remainingText = `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}min`;
      } else {
        remainingText = `${remainingMinutes} minute(s)`;
      }

      // Hook pour les badges (tentatives de fuite cumulées)
      const totalAttempts = await db.queryOne(`
        SELECT COALESCE(SUM(attempts_to_change), 0) as total FROM player_shame_nickname
        WHERE guild_id = $1 AND player_id = $2
      `, [guildId, player.id]);

      await badgeHandler.onShameNicknameEscapeAttempt(
        guildId,
        player.id,
        parseInt(totalAttempts?.total || 0) + 1,
        this.client
      );

      // Envoyer un DM moqueur au joueur
      try {
        await newMember.send({
          content: `🎭 **Nice try !**\n\n` +
            `Tu restes **${activeTrap.shame_nickname}** pendant encore **${remainingText}** !\n\n` +
            `🔢 Tentatives de fuite: **${activeTrap.attempts_to_change + 1}**\n` +
            `⏰ Expiration: <t:${Math.floor(new Date(activeTrap.expires_at).getTime() / 1000)}:R>\n\n` +
            `_Le sortilège est puissant, n'essaie même pas !_ 🧙‍♂️`
        });
      } catch (dmError) {
        // Le joueur a peut-être les DMs fermés
        console.log(`🎭 [SHAME] Impossible d'envoyer un DM à ${newMember.user.username}`);
      }

    } catch (error) {
      console.error('🔴 [SHAME] Erreur handleMemberUpdate:', error);
    }
  }

  /**
   * Nettoyer les pièges expirés et restaurer les pseudos originaux
   */
  async cleanupExpiredTraps() {
    if (!this.client) return;

    try {
      // Récupérer tous les pièges expirés
      const expiredTraps = await db.queryAll(`
        SELECT psn.*, p.discord_id, p.username
        FROM player_shame_nickname psn
        JOIN players p ON psn.player_id = p.id AND psn.guild_id = p.guild_id
        WHERE psn.is_active = TRUE
          AND psn.expires_at <= NOW()
      `);

      if (expiredTraps.length === 0) return;

      console.log(`🎭 [SHAME] ${expiredTraps.length} piège(s) expiré(s) à nettoyer`);

      for (const trap of expiredTraps) {
        try {
          // Récupérer le membre Discord
          const guild = await this.client.guilds.fetch(trap.guild_id);
          const member = await guild.members.fetch(trap.discord_id).catch(() => null);

          if (member) {
            // Restaurer le pseudo original (null = pseudo Discord par défaut)
            const originalNickname = trap.original_nickname === member.user.username ? null : trap.original_nickname;

            try {
              await member.setNickname(originalNickname, 'Piège Shame Nickname expiré - Pseudo restauré');
              console.log(`🎭 [SHAME] Pseudo restauré pour ${trap.username}: ${trap.shame_nickname} → ${trap.original_nickname || 'default'}`);
            } catch (nicknameError) {
              console.error(`🔴 [SHAME] Erreur restauration pseudo pour ${trap.username}:`, nicknameError.message);
            }

            // Envoyer un DM de fin de piège
            try {
              await member.send({
                content: `✅ **Malédiction levée !**\n\n` +
                  `Le sortilège "${trap.shame_nickname}" a pris fin.\n` +
                  `Ton pseudo a été restauré. Tu es libre ! 🎉\n\n` +
                  `📊 Tentatives de fuite: **${trap.attempts_to_change}**`
              });
            } catch (dmError) {
              // Ignorer les erreurs de DM
            }
          }

          // Marquer le piège comme inactif
          await db.query(`
            UPDATE player_shame_nickname
            SET is_active = FALSE
            WHERE id = $1
          `, [trap.id]);

          // Logger la fin du piège (schéma VPS: admin_id au lieu de actor_id/target_id)
          const durationMinutes = Math.floor((new Date(trap.expires_at) - new Date(trap.started_at)) / 60000);

          await db.query(`
            INSERT INTO audit_logs (guild_id, action, admin_id, details)
            VALUES ($1, 'shame_nickname_expired', $2, $3)
          `, [
            trap.guild_id,
            'SYSTEM',
            JSON.stringify({
              player_id: trap.player_id,
              shame_nickname: trap.shame_nickname,
              original_nickname: trap.original_nickname,
              duration_minutes: durationMinutes,
              total_attempts: trap.attempts_to_change
            })
          ]);

          // Hook pour les badges de durée de survie
          await badgeHandler.onShameNicknameExpired(
            trap.guild_id,
            trap.player_id,
            durationMinutes,
            this.client
          );

        } catch (trapError) {
          console.error(`🔴 [SHAME] Erreur nettoyage piège ${trap.id}:`, trapError);
        }
      }

    } catch (error) {
      console.error('🔴 [SHAME] Erreur cleanupExpiredTraps:', error);
    }
  }

  /**
   * Vérifier si un joueur est actuellement piégé
   */
  async isPlayerTrapped(guildId, playerId) {
    const trap = await db.queryOne(`
      SELECT id, shame_nickname, expires_at
      FROM player_shame_nickname
      WHERE guild_id = $1 AND player_id = $2 AND is_active = TRUE AND expires_at > NOW()
    `, [guildId, playerId]);

    return trap || null;
  }

  /**
   * Obtenir les stats des pièges shame nickname pour un serveur
   */
  async getStats(guildId) {
    const stats = await db.queryOne(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = TRUE AND expires_at > NOW()) as active_traps,
        COUNT(*) as total_traps,
        SUM(attempts_to_change) as total_attempts,
        AVG(attempts_to_change)::numeric(10,2) as avg_attempts
      FROM player_shame_nickname
      WHERE guild_id = $1
    `, [guildId]);

    return stats;
  }

  /**
   * Obtenir le classement des joueurs les plus piégés
   */
  async getLeaderboard(guildId, limit = 10) {
    const leaderboard = await db.queryAll(`
      SELECT
        p.username,
        p.discord_id,
        COUNT(*) as times_trapped,
        SUM(psn.attempts_to_change) as total_attempts,
        MAX(psn.expires_at) as last_trapped
      FROM player_shame_nickname psn
      JOIN players p ON psn.player_id = p.id AND psn.guild_id = p.guild_id
      WHERE psn.guild_id = $1
      GROUP BY p.id, p.username, p.discord_id
      ORDER BY times_trapped DESC, total_attempts DESC
      LIMIT $2
    `, [guildId, limit]);

    return leaderboard;
  }
}

module.exports = new ShameNicknameHandler();
