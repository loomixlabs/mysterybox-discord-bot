const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const permissions = require('../../utils/permissions');
const setupDiagnostic = require('../../utils/setupDiagnostic');
const oauthGenerator = require('../../utils/oauthGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check-setup')
    .setDescription('Diagnostic complet de la configuration du bot sur ce serveur'),
    // Note: Pas de setDefaultMemberPermissions pour permettre aux Super Admins
    // d'accéder même sans rôle Administrator Discord. Vérification dans execute().

  async execute(interaction) {
    // Vérifier les permissions
    const hasAccess = await permissions.canAccessAdminPanel(interaction);
    if (!hasAccess) {
      return interaction.reply({
        content: '❌ Vous n\'avez pas les permissions pour utiliser cette commande.',
        flags: 64
      });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      console.log(`🔍 Diagnostic demandé par ${interaction.user.tag} sur ${interaction.guild.name}`);

      // Exécuter le diagnostic complet
      const { combined, detailed } = await setupDiagnostic.runFullDiagnostic(interaction.guild);

      // Générer l'embed de résultat
      const embed = combined.toEmbed();

      // Ajouter l'URL d'invitation si des permissions manquent
      if (!combined.isHealthy) {
        const inviteUrl = oauthGenerator.generateInviteUrl(
          process.env.APPLICATION_ID,
          { guildId: interaction.guild.id }
        );

        embed.addFields({
          name: '🔗 Réinviter le Bot',
          value: `Si des permissions sont manquantes, [réinvitez le bot avec les bonnes permissions](${inviteUrl})`,
          inline: false
        });
      }

      // Ajouter des conseils
      let tips = [];

      if (detailed.hierarchy.errors.length > 0) {
        tips.push('⚠️ **Hiérarchie**: Remontez le rôle du bot dans Paramètres > Rôles');
      }

      if (detailed.database.warnings.some(w => w.message.includes('Aucun thème'))) {
        tips.push('🎨 **Thème**: Créez un thème via /admin-panel > Thèmes');
      }

      if (detailed.database.warnings.some(w => w.message.includes('rôle admin'))) {
        tips.push('👑 **Admins**: Configurez les rôles admin via /setup');
      }

      if (tips.length > 0) {
        embed.addFields({
          name: '💡 Conseils',
          value: tips.join('\n'),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

      console.log(`✅ Diagnostic terminé - Santé: ${combined.isHealthy ? 'OK' : 'PROBLEMES'}`);

    } catch (error) {
      console.error('🔴 Erreur diagnostic:', error);
      await interaction.editReply({
        content: `❌ Erreur lors du diagnostic: ${error.message}`
      });
    }
  }
};
