const db = require('./utils/database-pg');

async function analyzeCampaignsTable() {
  try {
    console.log('🔄 Analyse de la table give_campaigns...\n');

    // 1. Structure de la table
    console.log('📋 Structure de la table:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name='give_campaigns'
      ORDER BY ordinal_position;
    `);

    console.table(columns);

    // 2. Vérifier les campagnes existantes
    console.log('\n📊 Campagnes existantes:');
    const campaigns = await db.queryAll(`
      SELECT id, guild_id, campaign_id, campaign_type, mode, status,
             burst_count, burst_interval, scheduled_duration, scheduled_interval,
             total_gives_planned, total_gives_posted, started_at
      FROM give_campaigns
      ORDER BY started_at DESC
      LIMIT 5;
    `);

    if (campaigns && campaigns.length > 0) {
      console.table(campaigns);
    } else {
      console.log('Aucune campagne trouvée.');
    }

    // 3. Données du handler
    console.log('\n📝 Format attendu par campaignAdminHandler.js:');
    console.log(`
    campaignData = {
      guild_id: interaction.guildId,
      theme_id: theme.id,
      name: draft.name,
      mode: draft.mode,              // 'burst' ou 'schedule'
      channel_mode: draft.channelMode, // 'random' ou 'specific'
      target_channels: draft.targetChannels || [],

      // Pour mode 'burst':
      total_count: draft.totalCount,
      interval_seconds: draft.intervalSeconds,

      // Pour mode 'schedule':
      duration_days: draft.durationDays,
      frequency_hours: draft.frequencyHours
    }
    `);

    console.log('\n✅ Analyse terminée!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyzeCampaignsTable();
