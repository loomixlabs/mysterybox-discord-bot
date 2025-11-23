const db = require('./database-pg');

/**
 * Gestionnaire de rôle dédié au bot pour personnaliser sa couleur
 */
class BotRoleManager {
  /**
   * Créer ou récupérer le rôle dédié au bot
   * @param {Guild} guild - Le serveur Discord
   * @param {string} botName - Le nom d'affichage du bot
   * @param {string} color - Couleur hexadécimale du rôle
   * @returns {Promise<Role>} Le rôle créé ou existant
   */
  static async createOrGetBotRole(guild, botName = null, color = '#3498DB') {
    try {
      // Récupérer la config du serveur
      const branding = await db.getGuildBranding(guild.id);

      // Si un rôle existe déjà en BD, essayer de le récupérer
      if (branding.bot_role_id) {
        const existingRole = guild.roles.cache.get(branding.bot_role_id);
        if (existingRole) {
          console.log(`✅ Rôle bot existant trouvé: ${existingRole.name}`);
          return existingRole;
        } else {
          console.log(`⚠️  Rôle bot en BD mais introuvable sur Discord, création d'un nouveau...`);
        }
      }

      // Créer le nom du rôle (nom fixe, personnalisable via /server-config)
      const roleName = `🤖 Rôle Couleur - MysteryBox`;

      // Vérifier si un rôle avec ce nom existe déjà
      let role = guild.roles.cache.find(r => r.name === roleName);

      if (!role) {
        // Créer le rôle
        role = await guild.roles.create({
          name: roleName,
          color: parseInt(color.replace('#', ''), 16), // Convertir hex en integer
          hoist: false, // Ne pas afficher séparément dans la liste
          mentionable: false,
          reason: `Rôle dédié au bot pour personnalisation de la couleur`
        });

        console.log(`✅ Rôle bot créé: ${role.name} (${role.id})`);
      } else {
        console.log(`✅ Rôle bot existant récupéré: ${role.name}`);
      }

      // Sauvegarder l'ID du rôle en BD
      await db.updateGuildBranding(guild.id, {
        bot_role_id: role.id
      });

      // Assigner le rôle au bot
      await this.assignRoleToBot(guild, role);

      return role;

    } catch (error) {
      console.error(`❌ Erreur lors de la création du rôle bot:`, error);
      throw error;
    }
  }

  /**
   * Assigner le rôle dédié au bot
   * @param {Guild} guild - Le serveur Discord
   * @param {Role} role - Le rôle à assigner
   */
  static async assignRoleToBot(guild, role) {
    try {
      const botMember = guild.members.me;

      if (!botMember.roles.cache.has(role.id)) {
        await botMember.roles.add(role, 'Attribution du rôle dédié au bot');
        console.log(`✅ Rôle ${role.name} assigné au bot`);
      } else {
        console.log(`✅ Le bot a déjà le rôle ${role.name}`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors de l'attribution du rôle au bot:`, error);
      throw error;
    }
  }

  /**
   * Changer la couleur du rôle du bot
   * @param {Guild} guild - Le serveur Discord
   * @param {string} hexColor - Couleur hexadécimale (#RRGGBB)
   * @returns {Promise<Object>} Résultat avec le rôle et les membres affectés
   */
  static async changeBotRoleColor(guild, hexColor) {
    try {
      const branding = await db.getGuildBranding(guild.id);

      if (!branding.bot_role_id) {
        throw new Error('Aucun rôle bot configuré. Veuillez d\'abord exécuter /setup.');
      }

      const role = guild.roles.cache.get(branding.bot_role_id);

      if (!role) {
        throw new Error('Rôle bot introuvable. Il a peut-être été supprimé.');
      }

      // Compter les membres ayant ce rôle
      const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(role.id));
      const memberCount = membersWithRole.size;

      // Changer la couleur du rôle
      await role.setColor(hexColor, 'Changement de couleur via /server-config');

      console.log(`✅ Couleur du rôle ${role.name} changée en ${hexColor} (${memberCount} membre(s) affecté(s))`);

      return {
        role,
        memberCount,
        affectedMembers: membersWithRole.map(m => m.user.tag)
      };

    } catch (error) {
      console.error(`❌ Erreur lors du changement de couleur du rôle:`, error);
      throw error;
    }
  }

  /**
   * Obtenir les informations sur le rôle du bot
   * @param {Guild} guild - Le serveur Discord
   * @returns {Promise<Object>} Informations sur le rôle
   */
  static async getBotRoleInfo(guild) {
    try {
      const branding = await db.getGuildBranding(guild.id);

      if (!branding.bot_role_id) {
        return {
          exists: false,
          message: 'Aucun rôle bot configuré'
        };
      }

      const role = guild.roles.cache.get(branding.bot_role_id);

      if (!role) {
        return {
          exists: false,
          message: 'Rôle bot configuré mais introuvable (peut-être supprimé)'
        };
      }

      const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(role.id));
      const position = guild.roles.cache.size - role.position;

      return {
        exists: true,
        role,
        name: role.name,
        color: role.hexColor,
        memberCount: membersWithRole.size,
        position: role.position,
        positionFromBottom: position,
        members: membersWithRole.map(m => ({
          tag: m.user.tag,
          id: m.id
        }))
      };

    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des infos du rôle:`, error);
      throw error;
    }
  }

  /**
   * Générer un tutoriel pour remonter le rôle
   * @param {Guild} guild - Le serveur Discord
   * @returns {string} Message de tutoriel formaté
   */
  static async getRolePositionTutorial(guild) {
    const roleInfo = await this.getBotRoleInfo(guild);

    if (!roleInfo.exists) {
      return '❌ Aucun rôle bot configuré. Exécutez d\'abord `/setup`.';
    }

    const tutorial = `
📚 **TUTORIEL : Comment remonter le rôle du bot**

**Rôle actuel:** ${roleInfo.name}
**Couleur:** ${roleInfo.color} ■
**Position:** ${roleInfo.position} / ${guild.roles.cache.size} (du bas vers le haut)

**Pour que la couleur du bot soit visible dans Discord:**

1. **Ouvrir les Paramètres du serveur**
   • Clic droit sur le nom du serveur → "Paramètres du serveur"

2. **Aller dans Rôles**
   • Menu de gauche → "Rôles"

3. **Remonter le rôle "${roleInfo.name}"**
   • Glisser-déposer le rôle vers le haut
   • Plus le rôle est haut, plus sa couleur a de priorité

4. **Important :**
   ⚠️  Le rôle doit être au-dessus des autres rôles du bot
   ⚠️  Mais en-dessous du rôle de votre bot principal (celui avec les permissions)

5. **Vérification**
   • Regardez la liste des membres
   • Le bot devrait maintenant avoir la couleur configurée

**Astuce:** Pour un affichage optimal, placez ce rôle juste sous vos rôles d'administration.
`;

    return tutorial.trim();
  }
}

module.exports = BotRoleManager;
