/**
 * Thread Manager - Gestion robuste des threads Discord
 * Fournit des fonctions utilitaires pour archiver/supprimer les threads
 * avec retry pattern et gestion d'erreurs avancée
 */

const db = require('./database-pg');

class ThreadManager {
  constructor() {
    // Configuration par défaut
    this.config = {
      archiveRetries: 3,
      retryDelayMs: 2000,
      deleteOnFailure: false,
      logPrefix: '🧵 [THREAD]'
    };
  }

  /**
   * Archive un thread avec retry automatique
   * @param {ThreadChannel} thread - Thread Discord à archiver
   * @param {object} options - Options de configuration
   * @returns {Promise<{success: boolean, method: string, error?: Error}>}
   */
  async archiveWithRetry(thread, options = {}) {
    const maxRetries = options.retries || this.config.archiveRetries;
    const retryDelay = options.retryDelay || this.config.retryDelayMs;
    const deleteOnFail = options.deleteOnFailure ?? this.config.deleteOnFailure;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Vérifier que le thread est encore valide
        if (!thread || thread.archived) {
          console.log(`${this.config.logPrefix} Thread déjà archivé ou invalide`);
          return { success: true, method: 'already_archived' };
        }

        await thread.setArchived(true);
        console.log(`${this.config.logPrefix} Thread ${thread.id} archivé avec succès (tentative ${attempt}/${maxRetries})`);
        return { success: true, method: 'archived' };

      } catch (error) {
        console.warn(`${this.config.logPrefix} Tentative ${attempt}/${maxRetries} échouée: ${error.message}`);

        // Dernière tentative
        if (attempt === maxRetries) {
          // Essayer de supprimer le thread si configuré
          if (deleteOnFail) {
            try {
              await thread.delete('Archivage impossible - Suppression forcée');
              console.log(`${this.config.logPrefix} Thread ${thread.id} supprimé (fallback)`);
              return { success: true, method: 'deleted' };
            } catch (deleteError) {
              console.error(`${this.config.logPrefix} Impossible de supprimer le thread:`, deleteError.message);
            }
          }

          return { success: false, method: 'failed', error };
        }

        // Attendre avant le prochain essai
        await this.sleep(retryDelay);
      }
    }

    return { success: false, method: 'exhausted' };
  }

  /**
   * Archive un thread après un délai avec retry
   * Remplace les setTimeout vulnérables aux crashs
   * @param {ThreadChannel} thread - Thread à archiver
   * @param {number} delayMs - Délai en millisecondes
   * @param {object} options - Options supplémentaires
   */
  async archiveAfterDelay(thread, delayMs = 5000, options = {}) {
    const { missionProgressId, message } = options;

    // Envoyer un message d'avertissement si demandé
    if (message && thread) {
      try {
        await thread.send(message);
      } catch (e) {
        console.warn(`${this.config.logPrefix} Impossible d'envoyer le message de fermeture`);
      }
    }

    // Attendre le délai
    await this.sleep(delayMs);

    // Archiver avec retry
    const result = await this.archiveWithRetry(thread, options);

    // Si on a un mission_progress_id, mettre à jour le statut
    if (missionProgressId && result.success) {
      try {
        await db.query(
          `UPDATE mission_progress SET thread_archived = TRUE, updated_at = NOW() WHERE id = $1`,
          [missionProgressId]
        );
      } catch (e) {
        console.warn(`${this.config.logPrefix} Impossible de mettre à jour mission_progress`);
      }
    }

    return result;
  }

  /**
   * Nettoie les threads orphelins (mission failed mais thread encore ouvert)
   * @param {Client} client - Client Discord
   * @param {string} guildId - ID du serveur (optionnel, tous si non fourni)
   */
  async cleanupOrphanedThreads(client, guildId = null) {
    try {
      console.log(`${this.config.logPrefix} Recherche de threads orphelins...`);

      // Query pour trouver les missions avec thread potentiellement orphelin
      const query = guildId
        ? `SELECT * FROM mission_progress WHERE status IN ('failed', 'completed') AND thread_id IS NOT NULL AND (thread_archived IS NULL OR thread_archived = FALSE) AND guild_id = $1`
        : `SELECT * FROM mission_progress WHERE status IN ('failed', 'completed') AND thread_id IS NOT NULL AND (thread_archived IS NULL OR thread_archived = FALSE)`;

      const params = guildId ? [guildId] : [];
      const orphanedMissions = await db.queryAll(query, params);

      if (orphanedMissions.length === 0) {
        console.log(`${this.config.logPrefix} Aucun thread orphelin détecté`);
        return { cleaned: 0, failed: 0 };
      }

      console.log(`${this.config.logPrefix} ${orphanedMissions.length} thread(s) orphelin(s) détecté(s)`);

      let cleaned = 0;
      let failed = 0;
      let permissionsCleaned = 0;

      for (const mission of orphanedMissions) {
        try {
          // 🔐 FIX: Nettoyer les permissions temporaires si présentes
          const gameState = typeof mission.game_state === 'string'
            ? JSON.parse(mission.game_state || '{}')
            : (mission.game_state || {});

          if (gameState?.tempPermission) {
            const { channelId, userId } = gameState.tempPermission;
            if (channelId && userId) {
              try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (channel && channel.permissionOverwrites) {
                  await channel.permissionOverwrites.delete(userId, 'Nettoyage thread orphelin');
                  console.log(`🔐 [PERMISSION] Permission supprimée pour user ${userId} (thread orphelin)`);
                  permissionsCleaned++;
                }
              } catch (permError) {
                // Ignorer silencieusement
              }
            }

            // Nettoyer tempPermission du game_state
            await db.query(`
              UPDATE mission_progress
              SET game_state = CASE
                WHEN game_state IS NOT NULL THEN game_state - 'tempPermission'
                ELSE NULL
              END
              WHERE id = $1
            `, [mission.id]);
          }

          const thread = await client.channels.fetch(mission.thread_id).catch(() => null);

          if (thread && !thread.archived) {
            const result = await this.archiveWithRetry(thread);
            if (result.success) {
              cleaned++;
              await db.query(`UPDATE mission_progress SET thread_archived = TRUE WHERE id = $1`, [mission.id]);
            } else {
              failed++;
            }
          } else {
            // Thread déjà archivé ou supprimé - marquer comme traité
            await db.query(`UPDATE mission_progress SET thread_archived = TRUE WHERE id = $1`, [mission.id]);
            cleaned++;
          }
        } catch (error) {
          console.error(`${this.config.logPrefix} Erreur nettoyage mission ${mission.id}:`, error.message);
          failed++;
        }
      }

      if (permissionsCleaned > 0) {
        console.log(`🔐 [PERMISSION] ${permissionsCleaned} permission(s) temporaire(s) nettoyée(s) (threads orphelins)`);
      }

      console.log(`${this.config.logPrefix} Nettoyage terminé: ${cleaned} archivé(s), ${failed} échec(s)`);
      return { cleaned, failed };

    } catch (error) {
      console.error(`${this.config.logPrefix} Erreur cleanupOrphanedThreads:`, error);
      return { cleaned: 0, failed: 0, error };
    }
  }

  /**
   * Nettoie les missions abandonnées (créées mais jamais lancées)
   * @param {Client} client - Client Discord
   * @param {number} maxAgeMinutes - Âge maximum en minutes avant abandon (défaut: 30)
   */
  async cleanupAbandonedMissions(client, maxAgeMinutes = 30) {
    try {
      console.log(`${this.config.logPrefix} Recherche de missions abandonnées (> ${maxAgeMinutes} min)...`);

      // Missions in_progress sans expires_at depuis plus de X minutes
      const abandonedMissions = await db.queryAll(`
        SELECT mp.*, m.name as mission_name, p.discord_id, p.username
        FROM mission_progress mp
        JOIN missions m ON mp.mission_id = m.id
        JOIN players p ON mp.player_id = p.id
        WHERE mp.status = 'in_progress'
          AND mp.expires_at IS NULL
          AND mp.created_at < NOW() - INTERVAL '${maxAgeMinutes} minutes'
      `);

      if (abandonedMissions.length === 0) {
        console.log(`${this.config.logPrefix} Aucune mission abandonnée`);
        return { processed: 0 };
      }

      console.log(`${this.config.logPrefix} ${abandonedMissions.length} mission(s) abandonnée(s) détectée(s)`);

      let processed = 0;
      let permissionsCleaned = 0;

      for (const mission of abandonedMissions) {
        try {
          // 🔐 FIX: Nettoyer les permissions temporaires AVANT de changer le status
          const gameState = typeof mission.game_state === 'string'
            ? JSON.parse(mission.game_state || '{}')
            : (mission.game_state || {});

          if (gameState?.tempPermission) {
            const { channelId, userId } = gameState.tempPermission;
            if (channelId && userId) {
              try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (channel && channel.permissionOverwrites) {
                  await channel.permissionOverwrites.delete(userId, 'Nettoyage mission abandonnée');
                  console.log(`🔐 [PERMISSION] Permission supprimée pour user ${userId} dans #${channel.name} (mission abandonnée)`);
                  permissionsCleaned++;
                }
              } catch (permError) {
                console.warn(`⚠️ [PERMISSION] Erreur suppression permission: ${permError.message}`);
              }
            }
          }

          // Marquer comme failed ET nettoyer tempPermission du game_state
          await db.query(`
            UPDATE mission_progress
            SET status = 'failed',
                game_state = CASE
                  WHEN game_state IS NOT NULL THEN game_state - 'tempPermission'
                  ELSE NULL
                END,
                updated_at = NOW()
            WHERE id = $1
          `, [mission.id]);

          // Archiver le thread si possible
          if (mission.thread_id) {
            const thread = await client.channels.fetch(mission.thread_id).catch(() => null);

            if (thread) {
              try {
                await thread.send('⏰ **Mission abandonnée** - Tu n\'as pas lancé la mission à temps. Le thread se ferme.');
              } catch (e) { /* Ignore */ }

              await this.archiveWithRetry(thread);
            }
          }

          console.log(`${this.config.logPrefix} Mission abandonnée ${mission.id} (${mission.mission_name}) marquée comme échouée`);
          processed++;

        } catch (error) {
          console.error(`${this.config.logPrefix} Erreur traitement mission abandonnée ${mission.id}:`, error);
        }
      }

      if (permissionsCleaned > 0) {
        console.log(`🔐 [PERMISSION] ${permissionsCleaned} permission(s) temporaire(s) nettoyée(s)`);
      }

      console.log(`${this.config.logPrefix} ${processed} mission(s) abandonnée(s) traitée(s)`);
      return { processed };

    } catch (error) {
      console.error(`${this.config.logPrefix} Erreur cleanupAbandonedMissions:`, error);
      return { processed: 0, error };
    }
  }

  /**
   * Utilitaire pour attendre
   * @param {number} ms - Millisecondes à attendre
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton
module.exports = new ThreadManager();
