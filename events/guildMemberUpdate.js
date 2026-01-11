/**
 * Événement: guildMemberUpdate
 * Surveille les changements de pseudo pour le piège "Shame Nickname"
 */

const shameNicknameHandler = require('../handlers/shameNicknameHandler');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,

  async execute(oldMember, newMember, client) {
    // Ignorer les bots
    if (newMember.user.bot) return;

    // Vérifier si le pseudo a changé
    if (oldMember.nickname !== newMember.nickname) {
      // Déléguer au handler spécialisé
      await shameNicknameHandler.onNicknameChange(oldMember, newMember, client);
    }
  }
};
