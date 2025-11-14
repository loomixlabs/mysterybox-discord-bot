const db = require('./database-pg');

/**
 * Définition des 4 pièges par défaut
 * Ces textes sont génériques et pourront être personnalisés par thème
 */
const DEFAULT_TRAPS = [
  {
    trap_id: 'trap-cooldown',
    name: 'Piège Temporel',
    type: 'cooldown',
    description: 'Un piège qui bloque temporairement l\'ouverture de boîtes mystère.',
    image_url: 'https://i.imgur.com/placeholder-trap-cooldown.png',
    cooldown_duration: 30,
    malus_points: 0,
    shame_message: 'Tu es tombé dans un piège ! Tu ne peux plus ouvrir de boîtes pendant {duration} minutes.',
    removes_collectible: false,
    notif_title: '⏱️ Piège Activé !',
    notif_description: '**Oups !** Tu es tombé dans un piège temporel !\n\nTu ne peux plus ouvrir de boîtes mystère pendant **{duration} minutes**.\n\n💡 Utilise ce temps pour préparer ta prochaine ouverture !',
    notif_color: '#f39c12',
    notif_footer: 'Le piège se désactivera automatiquement'
  },
  {
    trap_id: 'trap-lose-collectible',
    name: 'Piège Voleur',
    type: 'lose-collectible',
    description: 'Un piège qui vole un objet aléatoire de votre collection.',
    image_url: 'https://i.imgur.com/placeholder-trap-lose.png',
    cooldown_duration: 0,
    malus_points: 0,
    shame_message: 'Oh non ! Un piège t\'a fait perdre un objet de ta collection : **{collectible}**',
    removes_collectible: true,
    notif_title: '💀 Piège Voleur !',
    notif_description: '**Oh non !** Un piège vicieux t\'a volé un objet !\n\n🎁 **Objet perdu:** {collectible}\n\n⚠️ Sois plus prudent la prochaine fois !',
    notif_color: '#e74c3c',
    notif_footer: 'L\'objet a été retiré de ta collection'
  },
  {
    trap_id: 'trap-public-shame',
    name: 'Piège de la Honte',
    type: 'public-shame',
    description: 'Un piège qui expose publiquement votre échec devant tout le serveur.',
    image_url: 'https://i.imgur.com/placeholder-trap-shame.png',
    cooldown_duration: 0,
    malus_points: 0,
    shame_message: '🤡 {user} est tombé dans un piège ridicule ! Quelle maladresse !',
    removes_collectible: false,
    notif_title: '😱 Piège de la Honte !',
    notif_description: '**Aïe !** Tu as déclenché le piège de la honte publique !\n\n🤡 Tout le monde va savoir que tu es tombé dans ce piège ridicule.\n\n💡 Essaye de mieux faire la prochaine fois !',
    notif_color: '#9b59b6',
    notif_footer: 'Ta maladresse a été annoncée publiquement'
  },
  {
    trap_id: 'trap-malus-points',
    name: 'Piège Maudit',
    type: 'points-malus',
    description: 'Un piège qui ajoute des points de malédiction à votre score.',
    image_url: 'https://i.imgur.com/placeholder-trap-malus.png',
    cooldown_duration: 0,
    malus_points: 10,
    shame_message: '⚠️ Tu es tombé dans un piège maudit ! +{points} points de malédiction.',
    removes_collectible: false,
    notif_title: '⚠️ Piège Maudit !',
    notif_description: '**Malédiction !** Tu as déclenché un piège maudit !\n\n👻 **+{points} points de malédiction** ajoutés à ton score.\n\n⚠️ Les points de malédiction pourraient t\'affecter négativement !',
    notif_color: '#c0392b',
    notif_footer: 'Les points de malédiction ont été ajoutés'
  },
  {
    trap_id: 'trap-empty-box',
    name: 'La Boîte Vide',
    type: 'empty-box',
    description: 'Sérieusement, qui peut bien avoir l\'idée d\'envoyer une boîte vide ?',
    image_url: 'https://i.imgur.com/placeholder-trap-empty.png',
    cooldown_duration: 0,
    malus_points: 0,
    shame_message: '📦 La boîte est... vide ? Complètement vide ! Rien du tout.',
    removes_collectible: false,
    notif_title: '📦 BOÎTE VIDE !',
    notif_description: '**Sérieusement ?** Tu as ouvert une boîte... complètement vide !\n\n🤷 Pas de collectible, pas de mission, rien du tout. Juste le néant.\n\n💡 Au moins tu n\'as rien perdu !',
    notif_color: '#95a5a6',
    notif_footer: 'Mieux vaut en rire ! 🤷'
  },
  {
    trap_id: 'trap-lose-all-collectibles',
    name: 'Piège Dévastateur',
    type: 'lose-all-collectibles',
    description: 'Un piège catastrophique qui fait perdre TOUS vos collectibles d\'un seul coup.',
    image_url: 'https://i.imgur.com/placeholder-trap-devastator.png',
    cooldown_duration: 0,
    malus_points: 0,
    shame_message: '💥 {user} a déclenché le piège dévastateur ! Tous ses collectibles ont disparu... ({count} objets perdus)',
    removes_collectible: true,
    notif_title: '💥 PIÈGE DÉVASTATEUR !',
    notif_description: '**CATASTROPHE TOTALE !** Ce piège apocalyptique a effacé **TOUS TES COLLECTIBLES** !\n\n💔 **{count} objet(s) perdu(s)** d\'un seul coup...\n\n⚠️ Ta collection a été complètement anéantie. Il va falloir tout recommencer !',
    notif_color: '#8b0000',
    notif_footer: 'Tout a disparu... 💔'
  }
];

/**
 * Créer les 6 pièges par défaut pour un thème
 * @param {string} guildId - ID du serveur Discord
 * @param {number} themeId - ID du thème
 * @returns {Promise<void>}
 */
async function createDefaultTrapsForTheme(guildId, themeId) {
  console.log(`\n🔧 Création des pièges par défaut pour le thème ${themeId} (serveur ${guildId})...`);

  try {
    // Vérifier si les pièges par défaut existent déjà pour ce thème
    const existingTraps = await db.queryAll(
      `SELECT trap_id FROM traps WHERE guild_id = $1 AND theme_id = $2 AND is_default = TRUE`,
      [guildId, themeId]
    );

    if (existingTraps.length >= 6) {
      console.log('✅ Les 6 pièges par défaut existent déjà pour ce thème');
      return;
    }

    // Créer chaque piège par défaut
    for (const trap of DEFAULT_TRAPS) {
      // Vérifier si ce piège spécifique existe déjà
      const exists = await db.queryOne(
        `SELECT trap_id FROM traps WHERE guild_id = $1 AND theme_id = $2 AND trap_id = $3`,
        [guildId, themeId, trap.trap_id]
      );

      if (!exists) {
        await db.query(
          `INSERT INTO traps (
            guild_id, theme_id, trap_id, name, type, description, image_url,
            cooldown_duration, malus_points, shame_message, removes_collectible,
            is_default, is_active, notif_title, notif_description, notif_color, notif_footer
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            guildId,
            themeId,
            trap.trap_id,
            trap.name,
            trap.type,
            trap.description,
            trap.image_url,
            trap.cooldown_duration,
            trap.malus_points,
            trap.shame_message,
            trap.removes_collectible,
            true, // is_default
            true, // is_active
            trap.notif_title,
            trap.notif_description,
            trap.notif_color,
            trap.notif_footer
          ]
        );
        console.log(`✅ Piège créé: ${trap.name} (${trap.type})`);
      } else {
        console.log(`⏭️  Piège déjà existant: ${trap.name}`);
      }
    }

    console.log('✅ Tous les pièges par défaut ont été créés');

  } catch (error) {
    console.error('❌ Erreur lors de la création des pièges par défaut:', error);
    throw error;
  }
}

/**
 * Mettre à jour les pièges par défaut existants pour les marquer comme is_default = true
 * (Pour les thèmes créés avant la mise à jour)
 * @param {string} guildId - ID du serveur Discord
 * @param {number} themeId - ID du thème
 * @returns {Promise<void>}
 */
async function markExistingTrapsAsDefault(guildId, themeId) {
  try {
    // Marquer les pièges existants comme par défaut s'ils correspondent aux types standards
    const result = await db.query(
      `UPDATE traps
       SET is_default = TRUE
       WHERE guild_id = $1
         AND theme_id = $2
         AND type IN ('cooldown', 'lose-collectible', 'public-shame', 'points-malus', 'empty-box')
         AND is_default = FALSE`,
      [guildId, themeId]
    );

    console.log(`✅ ${result.rowCount} piège(s) marqué(s) comme par défaut`);
  } catch (error) {
    console.error('❌ Erreur lors du marquage des pièges:', error);
    throw error;
  }
}

/**
 * Vérifier et compléter les pièges manquants pour un thème
 * @param {string} guildId - ID du serveur Discord
 * @param {number} themeId - ID du thème
 * @returns {Promise<void>}
 */
async function ensureAllDefaultTraps(guildId, themeId) {
  try {
    // Récupérer les types de pièges existants
    const existingTypes = await db.queryAll(
      `SELECT type FROM traps WHERE guild_id = $1 AND theme_id = $2 AND is_default = TRUE`,
      [guildId, themeId]
    );

    const existingTypeSet = new Set(existingTypes.map(t => t.type));
    const missingTraps = DEFAULT_TRAPS.filter(trap => !existingTypeSet.has(trap.type));

    if (missingTraps.length === 0) {
      console.log('✅ Tous les pièges par défaut sont présents');
      return;
    }

    console.log(`🔧 Ajout de ${missingTraps.length} piège(s) manquant(s)...`);

    // Créer les pièges manquants
    for (const trap of missingTraps) {
      await db.query(
        `INSERT INTO traps (
          guild_id, theme_id, trap_id, name, type, description, image_url,
          cooldown_duration, malus_points, shame_message, removes_collectible,
          is_default, is_active, notif_title, notif_description, notif_color, notif_footer
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          guildId,
          themeId,
          trap.trap_id,
          trap.name,
          trap.type,
          trap.description,
          trap.image_url,
          trap.cooldown_duration,
          trap.malus_points,
          trap.shame_message,
          trap.removes_collectible,
          true, // is_default
          true, // is_active
          trap.notif_title,
          trap.notif_description,
          trap.notif_color,
          trap.notif_footer
        ]
      );
      console.log(`✅ Piège ajouté: ${trap.name} (${trap.type})`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des pièges:', error);
    throw error;
  }
}

module.exports = {
  DEFAULT_TRAPS,
  createDefaultTrapsForTheme,
  markExistingTrapsAsDefault,
  ensureAllDefaultTraps
};
