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
    type: 'trap_empty_box',
    title: '📦 BOÎTE VIDE !',
    description: '**{userName}** a ouvert **{trapName}**... et il n\'y avait RIEN dedans ! 😂\n\n🤷 Absolument rien. Pas de collectible, pas de mission, juste le néant cosmique.\n\n💡 Au moins, rien n\'a été perdu !',
    color: '#95a5a6',
    footer_text: 'Mieux vaut en rire ! 🤷',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'trap_lose_all_collectibles',
    title: '💀 PIÈGE DÉVASTATEUR !',
    description: '**{userName}** est tombé dans **{trapName}** !\n\n😱 **CATASTROPHE !** Tu as perdu **TOUS TES COLLECTIBLES** !\n\nUn moment de malchance absolue...',
    color: '#c0392b',
    footer_text: 'Tous les collectibles ont été perdus',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'trap_shame_nickname',
    title: '🎭 PSEUDO MODIFIÉ !',
    description: '**{userName}** est tombé dans **{trapName}** !\n\n🤡 Son pseudo a été changé en **"{shameNickname}"** !\n\n⏰ **Durée:** {duration}\n\n*Impossible de le changer... Bonne chance !*',
    color: '#E91E63',
    footer_text: 'Le pseudo sera restauré automatiquement',
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
  },

  // Super Bonus
  {
    type: 'legendary_super_bonus',
    title: '🎰 SUPER BONUS OBTENU !',
    description: '**{userName}** a obtenu un **SUPER BONUS** exceptionnel !\n\n{bonusIcon} **{bonusName}**\n\n🎉 Félicitations pour cette chance incroyable !',
    color: '#ff00ff',
    footer_text: 'Système de Super Bonus',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'super_bonus_joker_used',
    title: '🃏✨ MYSTERYBOX JOKER UTILISÉ ✨🃏',
    description: '╔═══════════════════════════════════╗\n║  🎰 **BONUS LÉGENDAIRE ACTIVÉ** 🎰  ║\n╚═══════════════════════════════════╝\n\n**{userName}** a utilisé son **MysteryBox Joker** !\n\n🎁 Collectible choisi:\n╭─────────────────────────╮\n│  ✨ **{collectibleName}**\n│  📊 Rareté: **{collectibleRarity}**\n╰─────────────────────────╯\n\n*Le pouvoir du Joker a été consommé !*',
    color: '#FFD700',
    footer_text: '🃏 MysteryBox Joker • Bonus Légendaire',
    image_url: null,
    thumbnail_url: null
  },

  // Évolution des Collectibles (Système de niveaux)
  {
    type: 'collectible_level_up',
    title: '⬆️ NIVEAU SUPÉRIEUR !',
    description: '**{userName}** a fusionné un doublon et fait monter de niveau son collectible !\n\n✨ **{collectibleName}**\n📈 Niveau **{oldLevel}** → **{newLevel}**\n🎯 XP: {currentXP}/{requiredXP}\n\n*Continue à collectionner pour atteindre le niveau max !*',
    color: '#9b59b6',
    footer_text: 'Système d\'évolution des collectibles',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'collectible_max_level',
    title: '🌟 NIVEAU MAXIMUM ATTEINT !',
    description: '**{userName}** a atteint le **NIVEAU MAXIMUM** sur un collectible !\n\n👑 **{collectibleName}**\n⭐ Niveau **{maxLevel}** - MAÎTRISE COMPLÈTE !\n🏆 Mint #{mintNumber}\n\n*Un accomplissement remarquable !* 🎉',
    color: '#f1c40f',
    footer_text: 'Maîtrise complète !',
    image_url: null,
    thumbnail_url: null
  },
  {
    type: 'collectible_restored',
    title: '🔄 COLLECTIBLE RESTAURÉ !',
    description: '**{userName}** a récupéré un collectible perdu avec sa progression intacte !\n\n🔮 **{collectibleName}**\n📈 Niveau restauré: **{level}**\n✨ XP conservé: **{xp}**\n🏆 Mint original: #{mintNumber}\n\n*Tes efforts n\'ont pas été perdus !*',
    color: '#2ecc71',
    footer_text: 'Progression restaurée',
    image_url: null,
    thumbnail_url: null
  },

  // Morpion (Tic-Tac-Toe)
  {
    type: 'tictactoe_result',
    title: '🎮 Fin de partie Morpion !',
    description: '🏆 **Gagnant**: {winner}\n😔 **Perdant**: {loser}\n\n📊 **Statistiques**:\n• Coups joués: {moves}\n• Durée: {duration}\n• Résolution: {resolution}\n\n🎁 **Récompense**: {reward}',
    color: '#5865F2',
    footer_text: 'Mission Morpion',
    image_url: null,
    thumbnail_url: null
  },

  // Cadeau Mystère à un ami
  {
    type: 'mystery_gift_sent',
    title: '🎁✨ CADEAU MYSTÈRE ENVOYÉ !',
    description: '🎀 **GÉNÉROSITÉ EN ACTION** 🎀\n\n🎁 **{giverName}** a envoyé un cadeau mystère à **{recipientName}** !\n\n*Un thread privé a été créé pour la remise du cadeau...*\n\n✨ *Que contient ce mystérieux présent ?* ✨',
    color: '#FF69B4',
    footer_text: '🎁 Cadeau Mystère à un ami',
    image_url: null,
    thumbnail_url: null  // L'image du cadeau sera définie via giftImageUrl
  },
  {
    type: 'mystery_gift_opened',
    title: '🎉✨ CADEAU MYSTÈRE OUVERT !',
    description: '🎁 **RÉVÉLATION DU CADEAU** 🎁\n\n🎉 **{recipientName}** a ouvert le cadeau de **{giverName}** !\n\n🎁 **Contenu:** {rarityEmoji} **{collectibleName}**\n📊 **Rareté:** {rarityLabel}\n\n*Merci pour cette générosité !* 💖',
    color: '#2ecc71',
    footer_text: '🎁 Cadeau Mystère à un ami • Ouvert !',
    image_url: null,
    thumbnail_url: null  // L'image générée du collectible sera attachée
  },

  // Recovery Bonus - Récupération massive de collectibles
  {
    type: 'all_collectibles_recovered',
    title: '🔄 RÉCUPÉRATION MASSIVE !',
    description: '**{userName}** a utilisé le super bonus **Recovery** !\n\n✨ **{restoredCount} collectible(s)** ont été restaurés avec leur progression intacte !\n\n📊 **Thèmes concernés:** {themesAffected}\n\n*Tous les efforts n\'ont pas été perdus !*',
    color: '#2ecc71',
    footer_text: '🔄 Super Bonus Recovery',
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
  trap_cooldown: true,
  trap_lose_collectible: true,
  trap_public_shame: true,
  trap_empty_box: true,
  trap_lose_all_collectibles: true,
  trap_shame_nickname: true,
  mission_word_guessed: true,
  mission_started: true,
  mission_completed: true,
  mission_failed: true,
  mission_approved: true,
  mission_rejected: true,
  theme_expired: true,
  theme_expiring_soon: true,
  legendary_super_bonus: true,
  super_bonus_joker_used: true,
  // Évolution des collectibles
  collectible_level_up: true,
  collectible_max_level: true,
  collectible_restored: true,
  // Morpion (Tic-Tac-Toe)
  tictactoe_result: true,
  // Cadeau Mystère à un ami
  mystery_gift_sent: true,
  mystery_gift_opened: true,
  // Recovery Bonus
  all_collectibles_recovered: true
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

/**
 * Créer les templates d'annonces par défaut pour un thème SPÉCIFIQUE
 * Chaque nouveau thème aura ses propres templates (avec theme_id défini)
 * @param {string} guildId - ID du serveur Discord
 * @param {number} themeId - ID du thème (dans la table themes)
 * @returns {Promise<number>} - Nombre de templates créés
 */
async function createDefaultTemplatesForTheme(guildId, themeId) {
  console.log(`\n📢 Création des templates d'annonces par défaut pour le thème ${themeId} (serveur ${guildId})...`);

  try {
    // Vérifier si les templates existent déjà pour ce thème
    const existingTemplates = await db.queryAll(
      `SELECT type FROM announcement_templates WHERE guild_id = $1 AND theme_id = $2`,
      [guildId, themeId]
    );

    const existingTypes = existingTemplates.map(t => t.type);

    if (existingTypes.length >= DEFAULT_ANNOUNCEMENT_TEMPLATES.length) {
      console.log(`✅ Les templates par défaut existent déjà pour ce thème (${existingTypes.length}/${DEFAULT_ANNOUNCEMENT_TEMPLATES.length})`);
      return 0;
    }

    // Créer chaque template manquant pour ce thème spécifique
    let created = 0;
    for (const template of DEFAULT_ANNOUNCEMENT_TEMPLATES) {
      // Vérifier si ce template spécifique existe déjà pour ce thème
      if (existingTypes.includes(template.type)) {
        console.log(`   ⏭️  Template ${template.type} déjà existant pour ce thème`);
        continue;
      }

      await db.query(
        `INSERT INTO announcement_templates (
          guild_id, type, title, description, color, footer_text, image_url, thumbnail_url, theme_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          guildId,
          template.type,
          template.title,
          template.description,
          template.color,
          template.footer_text,
          template.image_url,
          template.thumbnail_url,
          themeId  // <-- Lié au thème spécifique
        ]
      );
      created++;
      console.log(`   ✅ Template ${template.type} créé pour thème ${themeId}`);
    }

    console.log(`\n✅ ${created} template(s) créé(s) pour le thème ${themeId}`);
    return created;

  } catch (error) {
    console.error(`❌ Erreur lors de la création des templates pour le thème ${themeId}:`, error);
    throw error;
  }
}

module.exports = {
  DEFAULT_ANNOUNCEMENT_TEMPLATES,
  DEFAULT_ANNOUNCEMENT_TOGGLES,
  createDefaultTemplatesForGuild,
  ensureAllDefaultTemplates,
  createDefaultTemplatesForTheme
};
