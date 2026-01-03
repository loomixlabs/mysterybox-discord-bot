/**
 * Audit Logger
 *
 * Log toutes les actions faites par les admins dans leur admin panel
 * pour avoir une traçabilité complète et pouvoir débugger efficacement
 */

const db = require('./database-pg');

/**
 * Logger une action admin
 *
 * @param {string} guildId - ID du serveur
 * @param {string} adminId - Discord ID de l'admin
 * @param {string} action - Type d'action (ex: 'theme_created', 'collectible_added')
 * @param {object} details - Détails de l'action (sera converti en JSON)
 */
async function logAdminAction(guildId, adminId, action, details = {}) {
  try {
    await db.query(`
      INSERT INTO audit_logs (guild_id, admin_id, action, details)
      VALUES ($1, $2, $3, $4)
    `, [guildId, adminId, action, JSON.stringify(details)]);

    console.log(`📝 [AUDIT] ${guildId} | ${action} by ${adminId}`);
  } catch (error) {
    console.error('🔴 Erreur lors du logging de l\'action:', error);
    // Ne pas bloquer l'opération si le logging échoue
  }
}

/**
 * Raccourcis pour les actions courantes
 */

// THÈMES
async function logThemeCreated(guildId, adminId, themeData) {
  return logAdminAction(guildId, adminId, 'theme_created', {
    theme_id: themeData.id,
    theme_name: themeData.name,
    duration_days: themeData.duration_days,
    required_items: themeData.required_items
  });
}

async function logThemeActivated(guildId, adminId, themeId, previousThemeId = null) {
  return logAdminAction(guildId, adminId, 'theme_activated', {
    theme_id: themeId,
    previous_theme_id: previousThemeId
  });
}

async function logThemeUpdated(guildId, adminId, themeId, fieldChanged, oldValue, newValue) {
  return logAdminAction(guildId, adminId, 'theme_updated', {
    theme_id: themeId,
    field_changed: fieldChanged,
    old_value: oldValue,
    new_value: newValue
  });
}

async function logThemeDeleted(guildId, adminId, themeData) {
  return logAdminAction(guildId, adminId, 'theme_deleted', {
    theme_id: themeData.id,
    theme_name: themeData.name
  });
}

// COLLECTIBLES
async function logCollectibleAdded(guildId, adminId, collectibleData) {
  return logAdminAction(guildId, adminId, 'collectible_added', {
    collectible_id: collectibleData.collectible_id,
    name: collectibleData.name,
    rarity: collectibleData.rarity,
    theme_id: collectibleData.theme_id
  });
}

async function logCollectibleDeleted(guildId, adminId, collectibleData) {
  return logAdminAction(guildId, adminId, 'collectible_deleted', {
    collectible_id: collectibleData.collectible_id,
    name: collectibleData.name
  });
}

async function logCollectibleEdited(guildId, adminId, collectibleData, changes) {
  return logAdminAction(guildId, adminId, 'collectible_edited', {
    collectible_id: collectibleData.id,
    name: collectibleData.name,
    changes: changes
  });
}

// MISSIONS
async function logMissionAdded(guildId, adminId, missionData) {
  return logAdminAction(guildId, adminId, 'mission_added', {
    mission_id: missionData.mission_id,
    name: missionData.name,
    type: missionData.type,
    theme_id: missionData.theme_id
  });
}

async function logMissionUpdated(guildId, adminId, missionId, fieldChanged, oldValue, newValue) {
  return logAdminAction(guildId, adminId, 'mission_updated', {
    mission_id: missionId,
    field_changed: fieldChanged,
    old_value: oldValue,
    new_value: newValue
  });
}

async function logMissionDeleted(guildId, adminId, missionData) {
  return logAdminAction(guildId, adminId, 'mission_deleted', {
    mission_id: missionData.id,
    name: missionData.name
  });
}

async function logMissionKeywordAdded(guildId, adminId, missionId, keyword, difficulty) {
  return logAdminAction(guildId, adminId, 'mission_keyword_added', {
    mission_id: missionId,
    keyword: keyword,
    difficulty: difficulty
  });
}

async function logMissionKeywordDeleted(guildId, adminId, missionId, keyword) {
  return logAdminAction(guildId, adminId, 'mission_keyword_deleted', {
    mission_id: missionId,
    keyword: keyword
  });
}

async function logMissionQuizQuestionAdded(guildId, adminId, missionId, question, difficulty) {
  return logAdminAction(guildId, adminId, 'mission_quiz_question_added', {
    mission_id: missionId,
    question: question.substring(0, 100), // Limite pour éviter trop de données
    difficulty: difficulty
  });
}

async function logMissionQuizQuestionDeleted(guildId, adminId, missionId, questionId) {
  return logAdminAction(guildId, adminId, 'mission_quiz_question_deleted', {
    mission_id: missionId,
    question_id: questionId
  });
}

// PIÈGES
async function logTrapAdded(guildId, adminId, trapData) {
  return logAdminAction(guildId, adminId, 'trap_added', {
    trap_id: trapData.trap_id,
    name: trapData.name,
    type: trapData.type
  });
}

async function logTrapDeleted(guildId, adminId, trapData) {
  return logAdminAction(guildId, adminId, 'trap_deleted', {
    trap_id: trapData.id,
    name: trapData.name
  });
}

// CONFIGURATION
async function logProbabilitiesUpdated(guildId, adminId, oldValues, newValues) {
  return logAdminAction(guildId, adminId, 'probabilities_updated', {
    old_collectible: oldValues.collectible,
    old_mission: oldValues.mission,
    old_trap: oldValues.trap,
    new_collectible: newValues.collectible,
    new_mission: newValues.mission,
    new_trap: newValues.trap
  });
}

async function logMysteryBoxImageUpdated(guildId, adminId, oldUrl, newUrl) {
  return logAdminAction(guildId, adminId, 'mysterybox_image_updated', {
    old_url: oldUrl,
    new_url: newUrl
  });
}

async function logMysteryBoxTitleUpdated(guildId, adminId, oldTitle, newTitle) {
  return logAdminAction(guildId, adminId, 'mysterybox_title_updated', {
    old_title: oldTitle,
    new_title: newTitle
  });
}

async function logDurationUpdated(guildId, adminId, themeId, oldDuration, newDuration) {
  return logAdminAction(guildId, adminId, 'duration_updated', {
    theme_id: themeId,
    old_duration_days: oldDuration,
    new_duration_days: newDuration
  });
}

async function logWinnerMessageUpdated(guildId, adminId, oldMessage, newMessage) {
  return logAdminAction(guildId, adminId, 'winner_message_updated', {
    old_message: oldMessage?.substring(0, 100),
    new_message: newMessage?.substring(0, 100)
  });
}

// CANAUX
async function logChannelAdded(guildId, adminId, channelId, channelName, type) {
  return logAdminAction(guildId, adminId, 'channel_added', {
    channel_id: channelId,
    channel_name: channelName,
    type: type
  });
}

async function logChannelDeleted(guildId, adminId, channelId, channelName) {
  return logAdminAction(guildId, adminId, 'channel_deleted', {
    channel_id: channelId,
    channel_name: channelName
  });
}

async function logCategoryAdded(guildId, adminId, categoryId, categoryName) {
  return logAdminAction(guildId, adminId, 'category_added', {
    category_id: categoryId,
    category_name: categoryName
  });
}

async function logCategoryDeleted(guildId, adminId, categoryId) {
  return logAdminAction(guildId, adminId, 'category_deleted', {
    category_id: categoryId
  });
}

// CAMPAGNES
async function logCampaignCreated(guildId, adminId, campaignData) {
  return logAdminAction(guildId, adminId, 'campaign_created', {
    campaign_id: campaignData.id,
    mode: campaignData.mode,
    timing_type: campaignData.timing_type,
    cron_expression: campaignData.cron_expression
  });
}

async function logCampaignStarted(guildId, adminId, campaignId) {
  return logAdminAction(guildId, adminId, 'campaign_started', {
    campaign_id: campaignId
  });
}

async function logCampaignStopped(guildId, adminId, campaignId) {
  return logAdminAction(guildId, adminId, 'campaign_stopped', {
    campaign_id: campaignId
  });
}

async function logCampaignDeleted(guildId, adminId, campaignId) {
  return logAdminAction(guildId, adminId, 'campaign_deleted', {
    campaign_id: campaignId
  });
}

// GIVES
async function logGiveUniqueLaunched(guildId, adminId, giveData) {
  return logAdminAction(guildId, adminId, 'give_unique_launched', {
    mode: giveData.mode,
    item_id: giveData.item_id,
    channel_type: giveData.channel_type,
    timing: giveData.timing,
    channels_count: giveData.channels_count
  });
}

// ANNONCES
async function logAnnouncementTemplateUpdated(guildId, adminId, templateType, fieldChanged) {
  return logAdminAction(guildId, adminId, 'announcement_template_updated', {
    template_type: templateType,
    field_changed: fieldChanged
  });
}

async function logAnnouncementToggleChanged(guildId, adminId, toggleName, enabled) {
  return logAdminAction(guildId, adminId, 'announcement_toggle_changed', {
    toggle_name: toggleName,
    enabled: enabled
  });
}

// SUPER BONUS
/**
 * Super Bonus - Attribution
 * @param {string} guildId - ID du serveur
 * @param {string} userId - Discord ID du joueur qui reçoit le bonus
 * @param {string} bonusName - Nom du super bonus
 * @param {object} details - Détails supplémentaires
 */
async function logBonusGranted(guildId, userId, bonusName, details = {}) {
  return logAdminAction(guildId, 'system', 'bonus_granted', {
    user_id: userId,
    bonus_name: bonusName,
    obtained_from: details.obtained_from || 'unknown',
    mystery_box_id: details.mystery_box_id || null,
    bonus_id: details.bonus_id || null,
    rarity: details.rarity || null,
    duration_type: details.duration_type || null,
    duration_value: details.duration_value || null,
    ...details
  });
}

/**
 * Super Bonus - Utilisation
 * @param {string} guildId - ID du serveur
 * @param {string} userId - Discord ID du joueur qui utilise le bonus
 * @param {string} bonusName - Nom du super bonus
 * @param {object} details - Détails de l'utilisation
 */
async function logBonusUsed(guildId, userId, bonusName, details = {}) {
  return logAdminAction(guildId, userId, 'bonus_used', {
    bonus_name: bonusName,
    bonus_id: details.bonus_id || null,
    action: details.action || 'activated',
    result: details.result || null,
    remaining_charges: details.remaining_charges || null,
    effect_applied: details.effect_applied || null,
    ...details
  });
}

/**
 * Super Bonus - Expiration
 * @param {string} guildId - ID du serveur
 * @param {string} userId - Discord ID du joueur dont le bonus expire
 * @param {string} bonusName - Nom du super bonus
 * @param {object} details - Détails de l'expiration
 */
async function logBonusExpired(guildId, userId, bonusName, details = {}) {
  return logAdminAction(guildId, 'system', 'bonus_expired', {
    user_id: userId,
    bonus_name: bonusName,
    bonus_id: details.bonus_id || null,
    reason: details.reason || 'time_expired',
    total_uses: details.total_uses || 0,
    expires_at: details.expires_at || null,
    ...details
  });
}

/**
 * Super Bonus - Effet appliqué
 * @param {string} guildId - ID du serveur
 * @param {string} userId - Discord ID du joueur affecté
 * @param {string} bonusName - Nom du super bonus
 * @param {object} details - Détails de l'effet
 */
async function logBonusEffectApplied(guildId, userId, bonusName, details = {}) {
  return logAdminAction(guildId, userId, 'bonus_effect_applied', {
    bonus_name: bonusName,
    bonus_id: details.bonus_id || null,
    effect_type: details.effect_type || null,
    effect: details.effect || null,
    impact: details.impact || null,
    target: details.target || null,
    ...details
  });
}

module.exports = {
  logAdminAction,

  // Thèmes
  logThemeCreated,
  logThemeActivated,
  logThemeUpdated,
  logThemeDeleted,

  // Collectibles
  logCollectibleAdded,
  logCollectibleDeleted,
  logCollectibleEdited,

  // Missions
  logMissionAdded,
  logMissionUpdated,
  logMissionDeleted,
  logMissionKeywordAdded,
  logMissionKeywordDeleted,
  logMissionQuizQuestionAdded,
  logMissionQuizQuestionDeleted,

  // Pièges
  logTrapAdded,
  logTrapDeleted,

  // Configuration
  logProbabilitiesUpdated,
  logMysteryBoxImageUpdated,
  logMysteryBoxTitleUpdated,
  logDurationUpdated,
  logWinnerMessageUpdated,

  // Canaux
  logChannelAdded,
  logChannelDeleted,
  logCategoryAdded,
  logCategoryDeleted,

  // Campagnes
  logCampaignCreated,
  logCampaignStarted,
  logCampaignStopped,
  logCampaignDeleted,

  // Gives
  logGiveUniqueLaunched,

  // Annonces
  logAnnouncementTemplateUpdated,
  logAnnouncementToggleChanged,

  // Super Bonus
  logBonusGranted,
  logBonusUsed,
  logBonusExpired,
  logBonusEffectApplied
};
