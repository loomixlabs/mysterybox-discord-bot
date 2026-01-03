const cron = require('node-cron');
const db = require('../utils/database-pg');
const mysteryBoxHandler = require('./mysteryBoxHandler');

/**
 * Handler pour le système de campagnes
 */
class CampaignHandler {
  constructor() {
    // Map des timers actifs pour les campagnes burst
    this.burstTimers = new Map();

    // Map des tâches cron pour les campagnes schedule
    this.cronTasks = new Map();
  }

  /**
   * Initialiser les campagnes actives au démarrage du bot
   * @param {Client} client - Client Discord
   * @param {string} guildId - (Optionnel) Si fourni, initialise uniquement ce serveur. Sinon, tous les serveurs.
   */
  async initActiveCampaigns(client, guildId = null) {
    console.log('🔄 Initialisation des campagnes actives...');

    // Si pas de guildId spécifié, récupérer toutes les campagnes actives de tous les serveurs
    let campaigns;
    if (guildId) {
      campaigns = await db.getActiveCampaigns(guildId);
    } else {
      // Récupérer les campagnes actives de TOUS les serveurs
      campaigns = await db.queryAll(
        `SELECT * FROM give_campaigns
         WHERE status IN ('running', 'paused')
         ORDER BY started_at DESC`
      );
    }

    let initializedCount = 0;

    for (const campaign of campaigns) {
      try {
        if (campaign.campaign_type === 'burst') {
          // Vérifier si la campagne burst est terminée
          if (campaign.total_gives_posted >= campaign.burst_count) {
            await db.completeCampaign(campaign.guild_id, campaign.id);
            console.log(`✅ Campagne burst #${campaign.id} marquée comme terminée`);
          } else if (campaign.status === 'running') {
            // Ne reprendre que les campagnes "running" (pas "paused")
            // Vérifier si la campagne était déjà démarrée (redémarrage du bot)
            if (campaign.started_at) {
              console.log(`🔄 Reprise campagne burst #${campaign.id} [${campaign.guild_id}] (${campaign.total_gives_posted}/${campaign.burst_count})`);
              await this.resumeBurstCampaign(client, campaign);
              initializedCount++;
            } else {
              // Nouveau démarrage
              console.log(`🚀 Démarrage campagne burst #${campaign.id} [${campaign.guild_id}]`);
              await this.startBurstCampaign(client, campaign);
              initializedCount++;
            }
          }
        } else if (campaign.campaign_type === 'scheduled' && campaign.status === 'running') {
          // Ne reprendre que les campagnes "running" (pas "paused")
          // Vérifier si la campagne était déjà démarrée (redémarrage du bot)
          if (campaign.started_at) {
            console.log(`🔄 Reprise campagne schedule #${campaign.id} [${campaign.guild_id}]`);
            await this.resumeScheduleCampaign(client, campaign);
            initializedCount++;
          } else {
            // Nouveau démarrage
            console.log(`🚀 Démarrage campagne schedule #${campaign.id} [${campaign.guild_id}]`);
            await this.startScheduleCampaign(client, campaign);
            initializedCount++;
          }
        }
      } catch (error) {
        console.error(`🔴 Erreur initialisation campagne #${campaign.id}:`, error.message);
      }
    }

    console.log(`✅ ${initializedCount} campagne(s) active(s) initialisée(s) sur ${campaigns.length} trouvée(s)`);
  }

  /**
   * Lancer une campagne burst
   * @param {Client} client - Client Discord
   * @param {object} campaign - Données de la campagne
   */
  async startBurstCampaign(client, campaign) {
    console.log(`🚀 Démarrage campagne BURST #${campaign.id}`);

    // Marquer comme démarrée
    await db.markCampaignStarted(campaign.guild_id, campaign.id);

    // Fonction pour lancer une boîte
    const launchBox = async (index) => {
      try {
        // Récupérer la campagne mise à jour
        const updatedCampaign = await db.getCampaignById(campaign.guild_id, campaign.id);

        // Vérifier le statut
        if (updatedCampaign.status === 'stopped') {
          console.log(`⏹️ Campagne #${campaign.id} arrêtée`);
          this.burstTimers.delete(campaign.id);
          return;
        }

        if (updatedCampaign.status === 'paused') {
          console.log(`⏸️ Campagne #${campaign.id} en pause (skip)`);
          return;
        }

        // Vérifier si on a atteint le total
        if (updatedCampaign.total_gives_posted >= updatedCampaign.burst_count) {
          console.log(`✅ Campagne burst #${campaign.id} terminée (${updatedCampaign.total_gives_posted}/${updatedCampaign.burst_count})`);
          await db.completeCampaign(campaign.guild_id, campaign.id);
          this.burstTimers.delete(campaign.id);
          return;
        }

        // Sélectionner un salon
        const channel = await this.selectChannel(client, updatedCampaign);

        if (!channel) {
          console.error(`❌ Aucun salon valide trouvé pour campagne #${campaign.id}`);
          return;
        }

        // Créer la boîte mystère
        const message = await mysteryBoxHandler.createMysteryBox(channel, updatedCampaign.theme_id, null, null, updatedCampaign.guild_id);

        // Logger le lancement
        await db.logCampaignLaunch(campaign.guild_id, campaign.id, message.id, channel.id);
        await db.incrementCampaignLaunched(campaign.guild_id, campaign.id);

        console.log(`📦 Boîte ${updatedCampaign.total_gives_posted + 1}/${updatedCampaign.burst_count} lancée dans ${channel.name} (campagne #${campaign.id})`);

        // Vérifier si c'était la dernière
        if (updatedCampaign.total_gives_posted + 1 >= updatedCampaign.burst_count) {
          console.log(`🎉 Campagne burst #${campaign.id} complétée !`);
          await db.completeCampaign(campaign.guild_id, campaign.id);
          this.burstTimers.delete(campaign.id);
        }

      } catch (error) {
        console.error(`❌ Erreur lors du lancement boîte (campagne #${campaign.id}):`, error);
      }
    };

    // Lancer la première boîte immédiatement
    await launchBox(0);

    // Planifier les suivantes si pas encore terminé
    const updatedCampaign = await db.getCampaignById(campaign.guild_id, campaign.id);

    if (updatedCampaign.total_gives_posted < updatedCampaign.burst_count) {
      const remaining = updatedCampaign.burst_count - updatedCampaign.total_gives_posted;

      for (let i = 0; i < remaining; i++) {
        const delay = (i + 1) * updatedCampaign.burst_interval * 1000;

        const timer = setTimeout(() => launchBox(i + 1), delay);

        // Stocker le timer
        if (!this.burstTimers.has(campaign.id)) {
          this.burstTimers.set(campaign.id, []);
        }
        this.burstTimers.get(campaign.id).push(timer);
      }

      console.log(`⏰ ${remaining} lancements programmés avec intervalle de ${updatedCampaign.burst_interval}s`);
    }
  }

  /**
   * Reprendre une campagne burst (après redémarrage du bot)
   * @param {Client} client - Client Discord
   * @param {object} campaign - Données de la campagne
   */
  async resumeBurstCampaign(client, campaign) {
    console.log(`🔄 Reprise campagne BURST #${campaign.id} (${campaign.total_gives_posted}/${campaign.burst_count})`);

    // NE PAS mettre à jour started_at, NE PAS lancer de boîte immédiatement
    // Juste recréer les timers pour les boîtes restantes

    // Fonction pour lancer une boîte
    const launchBox = async (index) => {
      try {
        // Récupérer la campagne mise à jour
        const updatedCampaign = await db.getCampaignById(campaign.guild_id, campaign.id);

        // Vérifier le statut
        if (updatedCampaign.status === 'stopped') {
          console.log(`⏹️ Campagne #${campaign.id} arrêtée`);
          this.burstTimers.delete(campaign.id);
          return;
        }

        if (updatedCampaign.status === 'paused') {
          console.log(`⏸️ Campagne #${campaign.id} en pause (skip)`);
          return;
        }

        // Vérifier si on a atteint le total
        if (updatedCampaign.total_gives_posted >= updatedCampaign.burst_count) {
          console.log(`✅ Campagne burst #${campaign.id} terminée (${updatedCampaign.total_gives_posted}/${updatedCampaign.burst_count})`);
          await db.completeCampaign(campaign.guild_id, campaign.id);
          this.burstTimers.delete(campaign.id);
          return;
        }

        // Sélectionner un salon
        const channel = await this.selectChannel(client, updatedCampaign);

        if (!channel) {
          console.error(`❌ Aucun salon valide trouvé pour campagne #${campaign.id}`);
          return;
        }

        // Créer la boîte mystère
        const message = await mysteryBoxHandler.createMysteryBox(channel, updatedCampaign.theme_id, null, null, updatedCampaign.guild_id);

        // Logger le lancement
        await db.logCampaignLaunch(campaign.guild_id, campaign.id, message.id, channel.id);
        await db.incrementCampaignLaunched(campaign.guild_id, campaign.id);

        console.log(`📦 Boîte ${updatedCampaign.total_gives_posted + 1}/${updatedCampaign.burst_count} lancée dans ${channel.name} (campagne #${campaign.id})`);

        // Vérifier si c'était la dernière
        if (updatedCampaign.total_gives_posted + 1 >= updatedCampaign.burst_count) {
          console.log(`🎉 Campagne burst #${campaign.id} complétée !`);
          await db.completeCampaign(campaign.guild_id, campaign.id);
          this.burstTimers.delete(campaign.id);
        }

      } catch (error) {
        console.error(`❌ Erreur lors du lancement boîte (campagne #${campaign.id}):`, error);
      }
    };

    // Planifier les boîtes restantes SANS lancer immédiatement
    const remaining = campaign.burst_count - campaign.total_gives_posted;

    if (remaining > 0) {
      for (let i = 0; i < remaining; i++) {
        const delay = (i + 1) * campaign.burst_interval * 1000;

        const timer = setTimeout(() => launchBox(i), delay);

        // Stocker le timer
        if (!this.burstTimers.has(campaign.id)) {
          this.burstTimers.set(campaign.id, []);
        }
        this.burstTimers.get(campaign.id).push(timer);
      }

      console.log(`⏰ ${remaining} lancements programmés avec intervalle de ${campaign.burst_interval}s (reprise)`);
    }
  }

  /**
   * Lancer une campagne schedule
   * @param {Client} client - Client Discord
   * @param {object} campaign - Données de la campagne
   */
  async startScheduleCampaign(client, campaign) {
    console.log(`📅 Démarrage campagne SCHEDULE #${campaign.id}`);

    // Marquer comme démarrée
    await db.markCampaignStarted(campaign.guild_id, campaign.id);

    // 🆕 Lancer la première boîte immédiatement
    try {
      const channel = await this.selectChannel(client, campaign);

      if (channel) {
        const message = await mysteryBoxHandler.createMysteryBox(channel, campaign.theme_id, null, null, campaign.guild_id);
        await db.logCampaignLaunch(campaign.guild_id, campaign.id, message.id, channel.id);
        await db.incrementCampaignLaunched(campaign.guild_id, campaign.id);
        console.log(`📦 Première boîte schedule lancée immédiatement dans ${channel.name} (campagne #${campaign.id})`);
      } else {
        console.error(`❌ Aucun salon valide trouvé pour le lancement immédiat (campagne #${campaign.id})`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors du lancement immédiat (campagne #${campaign.id}):`, error);
    }

    // Créer expression cron pour les lancements suivants
    const cronExpression = `0 */${campaign.scheduled_interval} * * *`; // Toutes les X heures

    console.log(`⏰ Expression cron: ${cronExpression} (toutes les ${campaign.scheduled_interval}h)`);

    // Créer la tâche cron
    const task = cron.schedule(cronExpression, async () => {
      try {
        // Récupérer la campagne mise à jour
        const updatedCampaign = await db.getCampaignById(campaign.guild_id, campaign.id);

        // Vérifier le statut
        if (updatedCampaign.status === 'stopped' || updatedCampaign.status === 'completed') {
          console.log(`⏹️ Campagne schedule #${campaign.id} arrêtée/terminée`);
          task.stop();
          this.cronTasks.delete(campaign.id);
          return;
        }

        if (updatedCampaign.status === 'paused') {
          console.log(`⏸️ Campagne schedule #${campaign.id} en pause (skip)`);
          return;
        }

        // Vérifier les heures actives si configurées
        if (updatedCampaign.active_hours_start && updatedCampaign.active_hours_end) {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTime = currentHour * 60 + currentMinute;

          const [startHour, startMinute] = updatedCampaign.active_hours_start.split(':').map(Number);
          const [endHour, endMinute] = updatedCampaign.active_hours_end.split(':').map(Number);

          const startTime = startHour * 60 + startMinute;
          const endTime = endHour * 60 + endMinute;

          if (currentTime < startTime || currentTime > endTime) {
            console.log(`⏰ Hors plage horaire active (${updatedCampaign.active_hours_start}-${updatedCampaign.active_hours_end}), skip`);
            return;
          }
        }

        // Vérifier la durée
        const startedAt = new Date(updatedCampaign.started_at);
        const now = new Date();
        const daysSinceStart = (now - startedAt) / (1000 * 60 * 60 * 24);

        if (daysSinceStart >= updatedCampaign.scheduled_duration) {
          console.log(`✅ Campagne schedule #${campaign.id} terminée (durée écoulée)`);
          await db.completeCampaign(campaign.guild_id, campaign.id);
          task.stop();
          this.cronTasks.delete(campaign.id);
          return;
        }

        // Sélectionner un salon
        const channel = await this.selectChannel(client, updatedCampaign);

        if (!channel) {
          console.error(`❌ Aucun salon valide trouvé pour campagne #${campaign.id}`);
          return;
        }

        // Créer la boîte mystère
        const message = await mysteryBoxHandler.createMysteryBox(channel, updatedCampaign.theme_id, null, null, updatedCampaign.guild_id);

        // Logger le lancement
        await db.logCampaignLaunch(campaign.guild_id, campaign.id, message.id, channel.id);
        await db.incrementCampaignLaunched(campaign.guild_id, campaign.id);

        console.log(`📦 Boîte schedule lancée dans ${channel.name} (campagne #${campaign.id}, total: ${updatedCampaign.total_gives_posted + 1})`);

      } catch (error) {
        console.error(`❌ Erreur lors du lancement schedule (campagne #${campaign.id}):`, error);
      }
    });

    // Stocker la tâche
    this.cronTasks.set(campaign.id, task);

    console.log(`✅ Tâche cron activée pour campagne #${campaign.id}`);
  }

  /**
   * Reprendre une campagne schedule (après redémarrage du bot)
   * @param {Client} client - Client Discord
   * @param {object} campaign - Données de la campagne
   */
  async resumeScheduleCampaign(client, campaign) {
    console.log(`🔄 Reprise campagne SCHEDULE #${campaign.id}`);

    // NE PAS mettre à jour started_at, NE PAS lancer de boîte immédiatement
    // Juste réactiver la tâche cron

    // Créer expression cron
    const cronExpression = `0 */${campaign.scheduled_interval} * * *`; // Toutes les X heures

    console.log(`⏰ Expression cron: ${cronExpression} (toutes les ${campaign.scheduled_interval}h)`);

    // Créer la tâche cron
    const task = cron.schedule(cronExpression, async () => {
      try {
        // Récupérer la campagne mise à jour
        const updatedCampaign = await db.getCampaignById(campaign.guild_id, campaign.id);

        // Vérifier le statut
        if (updatedCampaign.status === 'stopped' || updatedCampaign.status === 'completed') {
          console.log(`⏹️ Campagne schedule #${campaign.id} arrêtée/terminée`);
          task.stop();
          this.cronTasks.delete(campaign.id);
          return;
        }

        if (updatedCampaign.status === 'paused') {
          console.log(`⏸️ Campagne schedule #${campaign.id} en pause (skip)`);
          return;
        }

        // Vérifier les heures actives si configurées
        if (updatedCampaign.active_hours_start && updatedCampaign.active_hours_end) {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTime = currentHour * 60 + currentMinute;

          const [startHour, startMinute] = updatedCampaign.active_hours_start.split(':').map(Number);
          const [endHour, endMinute] = updatedCampaign.active_hours_end.split(':').map(Number);

          const startTime = startHour * 60 + startMinute;
          const endTime = endHour * 60 + endMinute;

          if (currentTime < startTime || currentTime > endTime) {
            console.log(`⏰ Hors plage horaire active (${updatedCampaign.active_hours_start}-${updatedCampaign.active_hours_end}), skip`);
            return;
          }
        }

        // Vérifier la durée
        const startedAt = new Date(updatedCampaign.started_at);
        const now = new Date();
        const daysSinceStart = (now - startedAt) / (1000 * 60 * 60 * 24);

        if (daysSinceStart >= updatedCampaign.scheduled_duration) {
          console.log(`✅ Campagne schedule #${campaign.id} terminée (durée écoulée)`);
          await db.completeCampaign(campaign.guild_id, campaign.id);
          task.stop();
          this.cronTasks.delete(campaign.id);
          return;
        }

        // Sélectionner un salon
        const channel = await this.selectChannel(client, updatedCampaign);

        if (!channel) {
          console.error(`❌ Aucun salon valide trouvé pour campagne #${campaign.id}`);
          return;
        }

        // Créer la boîte mystère
        const message = await mysteryBoxHandler.createMysteryBox(channel, updatedCampaign.theme_id, null, null, updatedCampaign.guild_id);

        // Logger le lancement
        await db.logCampaignLaunch(campaign.guild_id, campaign.id, message.id, channel.id);
        await db.incrementCampaignLaunched(campaign.guild_id, campaign.id);

        console.log(`📦 Boîte schedule lancée dans ${channel.name} (campagne #${campaign.id}, total: ${updatedCampaign.total_gives_posted + 1})`);

      } catch (error) {
        console.error(`❌ Erreur lors du lancement schedule (campagne #${campaign.id}):`, error);
      }
    });

    // Stocker la tâche
    this.cronTasks.set(campaign.id, task);

    console.log(`✅ Tâche cron réactivée pour campagne #${campaign.id} (reprise)`);
  }

  /**
   * Sélectionner un salon selon le mode de la campagne
   */
  async selectChannel(client, campaign) {
    if (campaign.mode === 'specific') {
      // Parser le JSON des target_channels
      let targetChannels;
      try {
        targetChannels = typeof campaign.target_channels === 'string'
          ? JSON.parse(campaign.target_channels)
          : campaign.target_channels;
      } catch (error) {
        console.error('❌ Erreur lors du parsing de target_channels:', error);
        return null;
      }

      if (!targetChannels || targetChannels.length === 0) {
        console.error('❌ Aucun canal spécifié pour cette campagne');
        return null;
      }

      // Sélectionner un salon aléatoire parmi ceux spécifiés
      const channelId = targetChannels[Math.floor(Math.random() * targetChannels.length)];
      return client.channels.cache.get(channelId);
    } else {
      // Mode random: utiliser les canaux/catégories configurés dans give_channels
      const giveChannels = await db.getAllGiveChannels(campaign.guild_id);

      if (!giveChannels || giveChannels.length === 0) {
        console.error('❌ Aucun canal/catégorie configuré dans Paramétrage');
        return null;
      }

      // Récupérer tous les salons valides (canaux directs + canaux dans catégories)
      const validChannels = [];

      for (const giveChannel of giveChannels) {
        if (giveChannel.type === 'channel') {
          // Ajouter le canal direct
          const channel = client.channels.cache.get(giveChannel.discord_id);
          if (channel && channel.isTextBased() && !channel.isThread()) {
            validChannels.push(channel);
          }
        } else if (giveChannel.type === 'category') {
          // Ajouter tous les salons textuels de la catégorie
          const category = client.channels.cache.get(giveChannel.discord_id);
          if (category) {
            const textChannels = category.children.cache.filter(
              c => c.isTextBased() && !c.isThread()
            );
            validChannels.push(...Array.from(textChannels.values()));
          }
        }
      }

      if (validChannels.length === 0) {
        console.error('❌ Aucun salon textuel valide trouvé');
        return null;
      }

      // Sélectionner aléatoirement
      return validChannels[Math.floor(Math.random() * validChannels.length)];
    }
  }

  /**
   * Mettre une campagne en pause
   */
  async pauseCampaign(guildId, campaignId) {
    await db.updateCampaignStatus(guildId, campaignId, 'paused');
    console.log(`⏸️ Campagne #${campaignId} mise en pause`);
  }

  /**
   * Reprendre une campagne en pause
   * @param {string} guildId - ID du serveur
   * @param {number} campaignId - ID de la campagne
   * @param {Client} client - Client Discord (optionnel, pour relancer les timers)
   */
  async resumeCampaign(guildId, campaignId, client = null) {
    // Récupérer la campagne
    const campaign = await db.getCampaignById(guildId, campaignId);

    if (!campaign) {
      throw new Error('Campagne introuvable');
    }

    if (campaign.status !== 'paused') {
      console.warn(`⚠️ Campagne #${campaignId} n'est pas en pause (status: ${campaign.status})`);
    }

    // Mettre à jour le statut à 'running' (pas 'active' !)
    await db.updateCampaignStatus(guildId, campaignId, 'running');
    console.log(`▶️ Campagne #${campaignId} reprise (status: running)`);

    // Si un client Discord est fourni, relancer les timers/cron
    if (client) {
      if (campaign.campaign_type === 'burst') {
        // Relancer les timers pour les boîtes restantes
        await this.resumeBurstCampaign(client, campaign);
        console.log(`🔄 Timers burst relancés pour campagne #${campaignId}`);
      } else if (campaign.campaign_type === 'scheduled') {
        // Relancer la tâche cron
        await this.resumeScheduleCampaign(client, campaign);
        console.log(`🔄 Cron schedule relancé pour campagne #${campaignId}`);
      }
    }
  }

  /**
   * Arrêter une campagne définitivement
   */
  async stopCampaign(guildId, campaignId) {
    const campaign = await db.getCampaignById(guildId, campaignId);

    if (!campaign) {
      throw new Error('Campagne introuvable');
    }

    // Arrêter les timers/cron
    if (campaign.campaign_type === 'burst' && this.burstTimers.has(campaignId)) {
      const timers = this.burstTimers.get(campaignId);
      timers.forEach(timer => clearTimeout(timer));
      this.burstTimers.delete(campaignId);
    } else if (campaign.campaign_type === 'scheduled' && this.cronTasks.has(campaignId)) {
      const task = this.cronTasks.get(campaignId);
      task.stop();
      this.cronTasks.delete(campaignId);
    }

    // Mettre à jour le statut
    await db.updateCampaignStatus(guildId, campaignId, 'stopped');

    console.log(`⏹️ Campagne #${campaignId} arrêtée définitivement`);
  }
}

module.exports = new CampaignHandler();
