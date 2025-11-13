const db = require('./database-pg');

/**
 * Définition des templates d'annonces par défaut
 * Ces templates sont génériques et peuvent être personnalisés par serveur
 */
const DEFAULT_ANNOUNCEMENT_TEMPLATES = [
  // Collections
  {
    type: 'legendary_collectible',
    title: '⭐ COLLECTIBLE LÉGENDAIRE !',
    description: '**{userName}** vient d\'obtenir un collectible **LÉGENDAIRE** !\n\n🎁 **{collectibleName}**\n\nFélicitations pour cette trouvaille exceptionnelle ! 🎉',
    color: '#f1c40f',
    footer_text: 'Collectible Légendaire obtenu !',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'collection_completed',
    title: '🎉 COLLECTION COMPLÉTÉE !',
    description: '**Bravo {userName} !** 🎊\n\nTu as complété la collection **{themeName}** !\n\nTu as maintenant le rôle **{roleName}** ! 👑',
    color: '#2ecc71',
    footer_text: 'Félicitations ! 🎉',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'collection_traded',
    title: '🔄 ÉCHANGE DE COLLECTION !',
    description: '**{user1Name}** et **{user2Name}** ont échangé leurs collections pour la mission **{missionName}** !\n\nBravo pour votre collaboration ! 🤝',
    color: '#3498db',
    footer_text: 'Travail d\'équipe réussi !',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'collection_lost',
    title: '💀 COLLECTION PERDUE !',
    description: '**{userName}** est tombé dans le piège **{trapName}** et a perdu un collectible ! 😱\n\nSois plus prudent la prochaine fois !',
    color: '#e74c3c',
    footer_text: 'Dommage... Meilleure chance la prochaine fois !',
    image_url: null,
    thumbnail_url: null
  },

  // Pièges
  {
    type: 'trap_curse',
    title: '😈 MALÉDICTION ACTIVÉE !',
    description: '**{userName}** a déclenché **{trapName}** !\n\n⚠️ **Effet:** {trapEffect}\n\nSois prudent la prochaine fois !',
    color: '#9b59b6',
    footer_text: 'La malédiction est active',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'trap_cooldown',
    title: '⏱️ PIÈGE TEMPOREL !',
    description: '**{userName}** est tombé dans **{trapName}** !\n\n🔒 Tu ne peux plus ouvrir de boîtes pendant **{duration} minutes**.\n\nUtilise ce temps pour planifier ta prochaine stratégie !',
    color: '#f39c12',
    footer_text: 'Le piège se désactivera automatiquement',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'trap_lose_collectible',
    title: '💀 PIÈGE VOLEUR !',
    description: '**{userName}** est tombé dans **{trapName}** !\n\n😱 Tu as perdu : **{collectible}**\n\nFais plus attention aux pièges la prochaine fois !',
    color: '#e74c3c',
    footer_text: 'L\'objet a été retiré de la collection',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'trap_public_shame',
    title: '😱 PIÈGE DE LA HONTE !',
    description: '**{userName}** est tombé dans **{trapName}** !\n\n🤡 Tout le serveur peut maintenant voir ton échec !\n\nEssaye de faire mieux la prochaine fois !',
    color: '#9b59b6',
    footer_text: 'La honte publique est réelle',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'trap_malus_points',
    title: '⚠️ PIÈGE MAUDIT !',
    description: '**{userName}** est tombé dans **{trapName}** !\n\n👻 **+{points} points de malédiction** ajoutés !\n\nCes points pourraient t\'affecter négativement...',
    color: '#c0392b',
    footer_text: 'Points de malédiction ajoutés',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'trap_empty_box',
    title: '📦 BOÎTE VIDE !',
    description: '**{userName}** a ouvert **{trapName}**... et il n\'y avait RIEN dedans ! 😂\n\n🤷 Absolument rien. Pas de collectible, pas de mission, juste le néant cosmique.\n\n💡 Au moins, rien n\'a été perdu !',
    color: '#95a5a6',
    footer_text: 'Mieux vaut en rire ! 🤷',
    image_url: null,
    thumbnail_url: null
  },

  // Missions
  {
    type: 'mission_word_guessed',
    title: '🎯 MOT DEVINÉ !',
    description: '**{userName}** a réussi à faire dire le mot **"{word}"** pour la mission **{missionName}** !\n\n🎉 Bravo pour ta ruse !',
    color: '#2ecc71',
    footer_text: 'Mission accomplie avec succès !',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'mission_started',
    title: '⚔️ MISSION LANCÉE !',
    description: '**{userName}** a commencé la mission **{missionName}** !\n\n⏱️ **Temps limite:** {timeLimit}\n\nBonne chance !',
    color: '#3498db',
    footer_text: 'La mission est en cours',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'mission_completed',
    title: '✅ MISSION RÉUSSIE !',
    description: '**{userName}** a complété la mission **{missionName}** !\n\n🎁 **Récompense:** {rewardName}\n\nFélicitations ! 🎉',
    color: '#2ecc71',
    footer_text: 'Mission accomplie !',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'mission_failed',
    title: '❌ MISSION ÉCHOUÉE !',
    description: '**{userName}** a échoué la mission **{missionName}** !\n\n⚠️ **Raison:** {failReason}\n\nNe te décourage pas, réessaye !',
    color: '#e74c3c',
    footer_text: 'La prochaine fois sera la bonne !',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'mission_approved',
    title: '👍 MISSION APPROUVÉE !',
    description: '**{userName}** a réussi la mission **{missionName}** !\n\n✅ Approuvé par **{adminName}**\n🎁 **Récompense:** {rewardName}\n\nBien joué !',
    color: '#2ecc71',
    footer_text: 'Mission validée par un admin',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'mission_rejected',
    title: '⛔ MISSION REFUSÉE !',
    description: '**{userName}**, ta mission **{missionName}** a été refusée par **{adminName}**.\n\nVérifie les critères et réessaye !',
    color: '#e74c3c',
    footer_text: 'Mission non validée',
    image_url: null,
    thumbnail_url: null
  },

  // Thèmes
  {
    type: 'theme_expired',
    title: '🔴 THÈME EXPIRÉ !',
    description: 'Le thème **{themeName}** est maintenant terminé après **{durationDays} jours** !\n\n📅 **Date d\'expiration:** {expirationDate}\n\nMerci à tous les participants ! Un nouveau thème arrive bientôt ! 🎊',
    color: '#e74c3c',
    footer_text: 'Fin du thème',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'theme_expiring_soon',
    title: '⏰ THÈME EXPIRE BIENTÔT !',
    description: '**Attention !** Le thème **{themeName}** expire dans **{daysRemaining} jours** !\n\n📅 **Date d\'expiration:** {expirationDate}\n\nDépêchez-vous de compléter vos collections ! ⚡',
    color: '#f39c12',
    footer_text: 'Fin du thème approche',
    image_url: null,
    thumbnail_url: null
  }
];

/**
 * Les toggles d'annonces par défaut (tous activés)
 */
const DEFAULT_ANNOUNCEMENT_TOGGLES = {
  legendary_collectible: true,
  collection_completed: true,
  collection_traded: true,
  collection_lost: true,
  trap_curse: true,
  trap_cooldown: true,
  trap_lose_collectible: true,
  trap_public_shame: true,
  trap_malus_points: true,
  trap_empty_box: true,
  mission_word_guessed: true,
  mission_started: true,
  mission_completed: true,
  mission_failed: true,
  mission_approved: true,
  mission_rejected: true,
  theme_expired: true,
  theme_expiring_soon: true
};

/**
 * Créer les templates d'annonces par défaut pour un serveur
 * @param {string} guildId - ID du serveur Discord
 * @returns {Promise<void>}
 */
async function createDefaultTemplatesForGuild(guildId) {
  console.log(`\n📢 Création des templates d'annonces par défaut pour le serveur ${guildId}...`);

  try {
    // Vérifier si les templates existent déjà
    const existingTemplates = await db.queryAll(
      `SELECT type FROM announcement_templates WHERE guild_id = $1`,
      [guildId]
    );

    const existingTypes = existingTemplates.map(t => t.type);

    if (existingTypes.length >= DEFAULT_ANNOUNCEMENT_TEMPLATES.length) {
      console.log(`✅ Les templates par défaut existent déjà pour ce serveur (${existingTypes.length}/${DEFAULT_ANNOUNCEMENT_TEMPLATES.length})`);
      return;
    }

    // Créer chaque template manquant
    let created = 0;
    for (const template of DEFAULT_ANNOUNCEMENT_TEMPLATES) {
      // Vérifier si ce template spécifique existe déjà
      if (existingTypes.includes(template.type)) {
        console.log(`   ⏭️  Template ${template.type} déjà existant`);
        continue;
      }

      await db.query(
        `INSERT INTO announcement_templates (
          guild_id, type, title, description, color, footer_text, image_url, thumbnail_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          guildId,
          template.type,
          template.title,
          template.description,
          template.color,
          template.footer_text,
          template.image_url,
          template.thumbnail_url
        ]
      );
      created++;
      console.log(`   ✅ Template ${template.type} créé`);
    }

    console.log(`\n✅ ${created} template(s) créé(s) avec succès`);

    // Créer les settings d'annonces avec tous les toggles
    const existingSettings = await db.queryOne(
      `SELECT * FROM announcement_settings WHERE guild_id = $1`,
      [guildId]
    );

    if (!existingSettings) {
      console.log('\n🔧 Création des settings d\'annonces...');

      const columns = ['guild_id', ...Object.keys(DEFAULT_ANNOUNCEMENT_TOGGLES)];
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = [guildId, ...Object.values(DEFAULT_ANNOUNCEMENT_TOGGLES)];

      await db.query(
        `INSERT INTO announcement_settings (${columns.join(', ')})
         VALUES (${placeholders})`,
        values
      );
      console.log('   ✅ Settings d\'annonces créés avec tous les toggles activés');
    } else {
      console.log('\n✅ Settings d\'annonces déjà existants');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la création des templates:', error);
    throw error;
  }
}

/**
 * S'assurer que tous les templates par défaut existent pour un serveur
 * @param {string} guildId - ID du serveur Discord
 * @returns {Promise<void>}
 */
async function ensureAllDefaultTemplates(guildId) {
  try {
    await createDefaultTemplatesForGuild(guildId);
  } catch (error) {
    console.error(`❌ Erreur lors de la vérification des templates pour ${guildId}:`, error);
    throw error;
  }
}

module.exports = {
  DEFAULT_ANNOUNCEMENT_TEMPLATES,
  DEFAULT_ANNOUNCEMENT_TOGGLES,
  createDefaultTemplatesForGuild,
  ensureAllDefaultTemplates
};
