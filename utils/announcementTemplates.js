const db = require('./database-pg');

/**
 * Templates d'annonces par défaut pour tous les serveurs
 */
const DEFAULT_ANNOUNCEMENT_TEMPLATES = [
  // Templates de base
  {
    type: 'legendary_collectible',
    title: '🌟 Collectible Légendaire Trouvé !',
    description: '**{userName}** vient de trouver un collectible **LÉGENDAIRE** !\n\n✨ **{collectibleName}**\n\n🎉 Félicitations pour cette trouvaille exceptionnelle !',
    color: '#ffd700',
    footer_text: 'Collection Légendaire'
  },
  {
    type: 'collection_completed',
    title: '🏆 Collection Complétée !',
    description: '**{userName}** a complété la collection **{themeName}** !\n\n🎖️ **Nouveau rôle débloqué:** {roleName}\n\n👏 Bravo pour cette réussite !',
    color: '#00ff00',
    footer_text: 'Collection Complète'
  },
  {
    type: 'collection_traded',
    title: '🔄 Échange de Collection',
    description: '**{user1Name}** et **{user2Name}** ont échangé des collectibles de la mission **{missionName}** !\n\n🤝 Belle collaboration !',
    color: '#3498db',
    footer_text: 'Système d\'Échanges'
  },
  {
    type: 'mission_word_guessed',
    title: '🎯 Mot-Clé Trouvé !',
    description: '**{userName}** a trouvé le mot-clé **{word}** de la mission **{missionName}** !\n\n💡 Bravo pour cette découverte !',
    color: '#9b59b6',
    footer_text: 'Missions'
  },

  // Templates de missions
  {
    type: 'mission_started',
    title: '🎯 Mission Commencée !',
    description: '**{userName}** a commencé une nouvelle mission !\n\n📋 **Mission:** {missionName}\n⏱️ **Temps limite:** {timeLimit}\n\n💪 Bonne chance !',
    color: '#3498db',
    footer_text: 'Système de Missions'
  },
  {
    type: 'mission_completed',
    title: '✅ Mission Réussie !',
    description: '**{userName}** a terminé une mission !\n\n📋 **Mission:** {missionName}\n🎁 **Récompense:** {rewardName}\n\n🎉 Félicitations !',
    color: '#2ecc71',
    footer_text: 'Système de Missions'
  },
  {
    type: 'mission_failed',
    title: '❌ Mission Échouée',
    description: '**{userName}** n\'a pas pu terminer la mission à temps\n\n📋 **Mission:** {missionName}\n⚠️ **Raison:** {failReason}\n\n💡 Réessaye une prochaine fois !',
    color: '#e74c3c',
    footer_text: 'Système de Missions'
  },
  {
    type: 'mission_approved',
    title: '✅ Mission Approuvée !',
    description: '**{userName}** a vu sa mission approuvée par un admin !\n\n📋 **Mission:** {missionName}\n👤 **Approuvée par:** {adminName}\n🎁 **Récompense:** {rewardName}\n\n🎉 Félicitations !',
    color: '#27ae60',
    footer_text: 'Système de Missions'
  },
  {
    type: 'mission_rejected',
    title: '❌ Mission Rejetée',
    description: '**{userName}** a vu sa mission rejetée\n\n📋 **Mission:** {missionName}\n👤 **Rejetée par:** {adminName}\n\n💡 Vérifie les critères et réessaye !',
    color: '#c0392b',
    footer_text: 'Système de Missions'
  },

  // Templates de pièges spécifiques
  {
    type: 'trap_cooldown',
    title: '⏱️ Piège de Cooldown Déclenché !',
    description: '**{userName}** est tombé dans un piège !\n\n🎯 **Piège:** {trapName}\n⏱️ **Effet:** Cooldown de **{cooldownMinutes} minutes**\n\n💡 Il ne pourra pas ouvrir de boîtes mystère pendant un moment...',
    color: '#f39c12',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'trap_lose_collectible',
    title: '💀 Piège Voleur Activé !',
    description: '**{userName}** a perdu un collectible !\n\n🎯 **Piège:** {trapName}\n🎁 **Objet perdu:** {collectibleLost}\n\n⚠️ Un piège vicieux lui a volé un objet de sa collection !',
    color: '#e74c3c',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'trap_public_shame',
    title: '😱 Piège de la Honte !',
    description: '**{userName}** est tombé dans le piège de la honte !\n\n🎯 **Piège:** {trapName}\n\n🤡 {shameMessage}',
    color: '#9b59b6',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'trap_malus_points',
    title: '⚠️ Piège Maudit Déclenché !',
    description: '**{userName}** est victime d\'une malédiction !\n\n🎯 **Piège:** {trapName}\n👻 **Effet:** +{malusPoints} points de malédiction\n\n⚠️ Ces points pourraient avoir des conséquences négatives...',
    color: '#c0392b',
    footer_text: 'Système de Pièges'
  },

  // Templates génériques de pièges (pour compatibilité)
  {
    type: 'trap_curse',
    title: '👻 Piège Activé !',
    description: '**{userName}** est tombé dans un piège !\n\n🎯 **Piège:** {trapName}\n⚠️ **Effet:** {trapEffect}\n\n💡 Attention aux pièges !',
    color: '#e67e22',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'collection_lost',
    title: '😱 Collection Perdue !',
    description: '**{userName}** a perdu un objet à cause d\'un piège !\n\n🎯 **Piège:** {trapName}\n\n⚠️ Fais attention la prochaine fois !',
    color: '#e74c3c',
    footer_text: 'Système de Pièges'
  }
];

/**
 * Créer tous les templates d'annonces par défaut pour un serveur
 * @param {string} guildId - ID du serveur Discord
 * @returns {Promise<number>} Nombre de templates créés
 */
async function createDefaultTemplatesForGuild(guildId) {
  let createdCount = 0;

  for (const template of DEFAULT_ANNOUNCEMENT_TEMPLATES) {
    // Vérifier si le template existe déjà
    const exists = await db.queryOne(
      `SELECT type FROM announcement_templates WHERE guild_id = $1 AND type = $2`,
      [guildId, template.type]
    );

    if (!exists) {
      // Créer le template
      await db.query(
        `INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [guildId, template.type, template.title, template.description, template.color, template.footer_text]
      );
      createdCount++;
    }
  }

  return createdCount;
}

/**
 * Initialiser les announcement_settings pour un serveur (tous activés par défaut)
 * @param {string} guildId - ID du serveur Discord
 * @returns {Promise<void>}
 */
async function createDefaultAnnouncementSettings(guildId) {
  // Vérifier si les settings existent déjà
  const exists = await db.queryOne(
    `SELECT guild_id FROM announcement_settings WHERE guild_id = $1`,
    [guildId]
  );

  if (!exists) {
    // Créer les settings avec tous les types activés par défaut
    await db.query(
      `INSERT INTO announcement_settings (
        guild_id, legendary_collectible, collection_completed,
        collection_traded, collection_lost, trap_curse, mission_word_guessed,
        mission_started, mission_completed, mission_failed,
        mission_approved, mission_rejected,
        trap_cooldown, trap_lose_collectible, trap_public_shame, trap_malus_points
      ) VALUES (
        $1, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
        TRUE, TRUE, TRUE, TRUE, TRUE,
        TRUE, TRUE, TRUE, TRUE
      )`,
      [guildId]
    );
  }
}

module.exports = {
  DEFAULT_ANNOUNCEMENT_TEMPLATES,
  createDefaultTemplatesForGuild,
  createDefaultAnnouncementSettings
};
