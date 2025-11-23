/**
 * Handler pour la gestion des rôles de progression
 * Attribue automatiquement les rôles intermédiaires basés sur la collection
 */

const db = require('../utils/database-pg');

/**
 * Vérifie et attribue les rôles de progression si un nouveau seuil est atteint
 *
 * @param {Guild} guild - Instance Discord.Guild
 * @param {string} userId - Discord User ID
 * @param {string} guildId - Discord Guild ID
 * @param {number} themeId - ID du thème actif (DB)
 * @param {number} newCollectionCount - Nouveau nombre de collectibles (après ajout)
 * @returns {Object|null} - Rôle attribué ou null si aucun nouveau seuil atteint
 */
async function checkAndAssignProgressionRoles(guild, userId, guildId, themeId, newCollectionCount) {
  try {
    console.log(`🏅 [PROGRESSION] Vérification pour user ${userId}, collection: ${newCollectionCount}`);

    // 1. Récupérer la config du thème avec les progression_roles
    const themeConfig = await db.queryOne(
      'SELECT progression_roles FROM theme_config WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );

    if (!themeConfig || !themeConfig.progression_roles || themeConfig.progression_roles.length === 0) {
      console.log('🏅 [PROGRESSION] Aucun progression_role configuré pour ce thème');
      return null;
    }

    const progressionRoles = themeConfig.progression_roles;

    // 2. Récupérer le player_progress pour connaître les rôles déjà atteints
    const player = await db.queryOne(
      'SELECT id FROM players WHERE discord_id = $1 AND guild_id = $2',
      [userId, guildId]
    );

    if (!player) {
      console.log('🏅 [PROGRESSION] Joueur non trouvé');
      return null;
    }

    const progress = await db.queryOne(
      'SELECT achieved_progression_roles FROM player_progress WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3',
      [guildId, player.id, themeId]
    );

    const achievedRoles = progress?.achieved_progression_roles || [];
    console.log(`🏅 [PROGRESSION] Rôles déjà atteints: [${achievedRoles.join(', ')}]`);

    // 3. Trouver les nouveaux seuils atteints (exclure 100% = rôle final géré ailleurs)
    const newlyAchievedRoles = progressionRoles.filter(role => {
      const threshold = role.required_items;
      // Vérifier si le seuil est atteint ET pas encore dans achievedRoles
      // ET pas le rôle à 100% (qui est le final_role)
      return (
        newCollectionCount >= threshold &&
        !achievedRoles.includes(threshold) &&
        role.percentage < 100
      );
    });

    if (newlyAchievedRoles.length === 0) {
      console.log('🏅 [PROGRESSION] Aucun nouveau seuil atteint');
      return null;
    }

    // 4. Attribuer les nouveaux rôles Discord
    const member = await guild.members.fetch(userId);
    const assignedRoles = [];

    for (const roleConfig of newlyAchievedRoles) {
      console.log(`🏅 [PROGRESSION] Nouveau seuil atteint: ${roleConfig.required_items} items (${roleConfig.percentage}%)`);

      let discordRole = null;

      // Si on a déjà un discord_role_id, l'utiliser
      if (roleConfig.discord_role_id) {
        try {
          discordRole = await guild.roles.fetch(roleConfig.discord_role_id);
        } catch (e) {
          console.log(`⚠️  Rôle Discord ${roleConfig.discord_role_id} non trouvé, création...`);
        }
      }

      // Sinon, créer le rôle Discord
      if (!discordRole) {
        discordRole = await createProgressionRole(guild, roleConfig);

        // Mettre à jour le discord_role_id dans la config
        if (discordRole) {
          await updateProgressionRoleDiscordId(guildId, themeId, roleConfig.required_items, discordRole.id);
        }
      }

      // Attribuer le rôle au membre
      if (discordRole) {
        await member.roles.add(discordRole);
        console.log(`✅ [PROGRESSION] Rôle "${discordRole.name}" attribué à ${member.user.tag}`);
        assignedRoles.push({
          name: roleConfig.name,
          color: roleConfig.color,
          required_items: roleConfig.required_items,
          percentage: roleConfig.percentage,
          discord_role_id: discordRole.id
        });
      }

      // Marquer comme atteint
      await markProgressionRoleAchieved(guildId, player.id, themeId, roleConfig.required_items);
    }

    return assignedRoles.length > 0 ? assignedRoles[assignedRoles.length - 1] : null;

  } catch (error) {
    console.error('❌ [PROGRESSION] Erreur:', error);
    return null;
  }
}

/**
 * Crée un rôle Discord pour un seuil de progression
 */
async function createProgressionRole(guild, roleConfig) {
  try {
    const role = await guild.roles.create({
      name: roleConfig.name,
      color: roleConfig.color,
      hoist: roleConfig.hoist || false,
      mentionable: roleConfig.mentionable || false,
      reason: `Rôle de progression automatique (${roleConfig.percentage}%)`
    });

    console.log(`✅ [PROGRESSION] Rôle Discord créé: "${role.name}" (ID: ${role.id})`);
    return role;
  } catch (error) {
    console.error(`❌ [PROGRESSION] Erreur création rôle "${roleConfig.name}":`, error);
    return null;
  }
}

/**
 * Met à jour le discord_role_id dans theme_config.progression_roles
 */
async function updateProgressionRoleDiscordId(guildId, themeId, requiredItems, discordRoleId) {
  try {
    // Mettre à jour le JSONB en modifiant l'élément avec le bon required_items
    await db.query(`
      UPDATE theme_config
      SET progression_roles = (
        SELECT jsonb_agg(
          CASE
            WHEN (elem->>'required_items')::int = $3
            THEN elem || jsonb_build_object('discord_role_id', $4)
            ELSE elem
          END
        )
        FROM jsonb_array_elements(progression_roles) AS elem
      )
      WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, themeId, requiredItems, discordRoleId]);

    console.log(`✅ [PROGRESSION] discord_role_id ${discordRoleId} sauvegardé pour seuil ${requiredItems}`);
  } catch (error) {
    console.error('❌ [PROGRESSION] Erreur mise à jour discord_role_id:', error);
  }
}

/**
 * Marque un seuil de progression comme atteint pour un joueur
 */
async function markProgressionRoleAchieved(guildId, playerId, themeId, requiredItems) {
  try {
    await db.query(`
      UPDATE player_progress
      SET achieved_progression_roles = array_append(
        COALESCE(achieved_progression_roles, '{}'),
        $4
      )
      WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
    `, [guildId, playerId, themeId, requiredItems]);

    console.log(`✅ [PROGRESSION] Seuil ${requiredItems} marqué comme atteint`);
  } catch (error) {
    console.error('❌ [PROGRESSION] Erreur marquage seuil:', error);
  }
}

/**
 * Configure les progression_roles pour un thème (appelé lors de l'import)
 *
 * @param {string} guildId - Guild ID
 * @param {number} themeId - Theme ID (DB)
 * @param {Array} progressionRoles - Array des rôles de progression depuis le JSON
 */
async function setProgressionRoles(guildId, themeId, progressionRoles) {
  try {
    if (!progressionRoles || progressionRoles.length === 0) {
      console.log('🏅 [PROGRESSION] Aucun progression_role à configurer');
      return;
    }

    // Transformer pour s'assurer que le format est correct (sans discord_role_id initialement)
    const cleanRoles = progressionRoles.map(role => ({
      name: role.name,
      color: role.color,
      required_items: role.required_items,
      percentage: role.percentage,
      hoist: role.hoist || false,
      mentionable: role.mentionable || false
      // discord_role_id sera ajouté lors de la première attribution
    }));

    await db.query(`
      UPDATE theme_config
      SET progression_roles = $3::jsonb
      WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, themeId, JSON.stringify(cleanRoles)]);

    console.log(`✅ [PROGRESSION] ${cleanRoles.length} progression_roles configurés pour thème ${themeId}`);
  } catch (error) {
    console.error('❌ [PROGRESSION] Erreur configuration progression_roles:', error);
  }
}

/**
 * Récupère les progression_roles d'un thème
 */
async function getProgressionRoles(guildId, themeId) {
  try {
    const result = await db.queryOne(
      'SELECT progression_roles FROM theme_config WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );
    return result?.progression_roles || [];
  } catch (error) {
    console.error('❌ [PROGRESSION] Erreur récupération progression_roles:', error);
    return [];
  }
}

/**
 * Supprime tous les rôles Discord de progression lors de la désactivation d'un thème
 */
async function cleanupProgressionRoles(guild, guildId, themeId) {
  try {
    const progressionRoles = await getProgressionRoles(guildId, themeId);

    for (const roleConfig of progressionRoles) {
      if (roleConfig.discord_role_id) {
        try {
          const role = await guild.roles.fetch(roleConfig.discord_role_id);
          if (role) {
            await role.delete('Nettoyage des rôles de progression (thème désactivé)');
            console.log(`🗑️  [PROGRESSION] Rôle "${role.name}" supprimé`);
          }
        } catch (e) {
          console.log(`⚠️  [PROGRESSION] Rôle ${roleConfig.discord_role_id} déjà supprimé ou inaccessible`);
        }
      }
    }

    // Réinitialiser les discord_role_id dans la config
    await db.query(`
      UPDATE theme_config
      SET progression_roles = (
        SELECT jsonb_agg(elem - 'discord_role_id')
        FROM jsonb_array_elements(progression_roles) AS elem
      )
      WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, themeId]);

    console.log('✅ [PROGRESSION] Nettoyage terminé');
  } catch (error) {
    console.error('❌ [PROGRESSION] Erreur nettoyage:', error);
  }
}

module.exports = {
  checkAndAssignProgressionRoles,
  setProgressionRoles,
  getProgressionRoles,
  cleanupProgressionRoles,
  createProgressionRole
};
