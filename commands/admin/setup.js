const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const permissions = require('../../utils/permissions');
const setupDiagnostic = require('../../utils/setupDiagnostic');
const oauthGenerator = require('../../utils/oauthGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('🛠️ Configuration initiale du serveur (Wizard)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 }); // EPHEMERAL

    // PERMISSIONS: Seuls le propriétaire du serveur et les super admins peuvent utiliser /setup
    const isSuperAdmin = permissions.isSuperAdmin(interaction.user.id);
    const isOwner = permissions.isGuildOwner(interaction);

    if (!isSuperAdmin && !isOwner) {
      return interaction.editReply({
        content: '❌ Seul le **propriétaire du serveur** peut utiliser cette commande.\n\n' +
                 '💡 Si vous devez configurer les permissions, contactez le propriétaire du serveur.'
      });
    }

    // VÉRIFICATION AUTOMATIQUE: Hiérarchie et permissions
    console.log(`🔍 Setup: Diagnostic automatique pour ${interaction.guild.name}`);
    const hierarchyResult = await setupDiagnostic.checkRoleHierarchy(interaction.guild);
    const permissionsResult = await setupDiagnostic.checkBotPermissions(interaction.guild);

    // Si des erreurs critiques de hiérarchie ou permissions
    if (!hierarchyResult.isHealthy || !permissionsResult.isHealthy) {
      const warningEmbed = new EmbedBuilder()
        .setTitle('⚠️ Problèmes de Configuration Détectés')
        .setColor('#E74C3C')
        .setDescription(
          '**Avant de continuer, veuillez résoudre ces problèmes:**\n\n' +
          'Ces erreurs peuvent empêcher le bot de fonctionner correctement.'
        )
        .setTimestamp();

      // Erreurs de hiérarchie
      if (hierarchyResult.errors.length > 0) {
        const hierarchyErrors = hierarchyResult.errors
          .map(e => `❌ ${e.message}${e.details ? `\n   └─ ${e.details}` : ''}`)
          .join('\n');
        warningEmbed.addFields({
          name: '🔺 Hiérarchie des Rôles',
          value: hierarchyErrors.substring(0, 1024),
          inline: false
        });
      }

      // Erreurs de permissions
      if (permissionsResult.errors.length > 0) {
        const permErrors = permissionsResult.errors
          .slice(0, 5) // Limiter à 5 pour éviter l'encombrement
          .map(e => `❌ ${e.message}`)
          .join('\n');
        const suffix = permissionsResult.errors.length > 5
          ? `\n... et ${permissionsResult.errors.length - 5} autres permissions manquantes`
          : '';
        warningEmbed.addFields({
          name: '🔐 Permissions Manquantes',
          value: permErrors + suffix,
          inline: false
        });
      }

      // Ajouter le lien de réinvitation
      const inviteUrl = oauthGenerator.generateInviteUrl(
        process.env.APPLICATION_ID,
        { guildId: interaction.guild.id }
      );

      warningEmbed.addFields({
        name: '💡 Solution',
        value: `1. **Hiérarchie**: Allez dans Paramètres du serveur → Rôles → Remontez le rôle du bot AU-DESSUS des rôles qu'il doit gérer\n\n` +
               `2. **Permissions**: [Cliquez ici pour réinviter le bot avec les bonnes permissions](${inviteUrl})`,
        inline: false
      });

      // Boutons pour continuer malgré tout ou annuler
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('setup_continue_anyway')
          .setLabel('⚠️ Continuer malgré tout')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('setup_run_diagnostic')
          .setLabel('🔍 Diagnostic Complet')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_cancel')
          .setLabel('❌ Annuler')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [warningEmbed],
        components: [row]
      });
    }

    // Avertissements non-bloquants (affichés mais on continue)
    if (hierarchyResult.hasWarnings || permissionsResult.hasWarnings) {
      console.log(`⚠️ Setup: Avertissements détectés mais non-bloquants`);
    }

    // Afficher l'étape 1: Configuration des rôles admin
    await showRoleConfiguration(interaction);
  }
};

/**
 * ÉTAPE 1: Configuration des rôles admin
 */
async function showRoleConfiguration(interaction) {
  // Récupérer les rôles actuellement configurés
  const currentRoles = await permissions.getAdminRoles(interaction.guildId);

  const embed = new EmbedBuilder()
    .setTitle('🎮 Configuration du Bot - Étape 1/3')
    .setColor('#3498db')
    .setFooter({ text: `${interaction.guild.name} • Étape 1: Équipe → Étape 2: Thème → Étape 3: Finalisation` })
    .setTimestamp();

  // Section principale
  embed.setDescription(
    '## 👥 Qui peut gérer le bot ?\n\n' +
    'Sélectionnez les rôles de votre équipe qui pourront accéder au **panneau d\'administration** (`/admin-panel`).\n\n' +
    '> 💡 **Conseil**: Choisissez les rôles de vos modérateurs ou organisateurs qui géreront les events.'
  );

  // Afficher les rôles actuels
  if (currentRoles.length === 0) {
    embed.addFields({
      name: '📋 Rôles autorisés',
      value: '```\nAucun rôle configuré\n```\n' +
             '⚠️ Seul vous (propriétaire) pouvez actuellement accéder à `/admin-panel`.',
      inline: false
    });
  } else {
    const rolesList = currentRoles
      .map(roleData => {
        const role = interaction.guild.roles.cache.get(roleData.role_id);
        return role ? `• <@&${role.id}>` : `• ~~Rôle supprimé~~`;
      })
      .join('\n');

    embed.addFields({
      name: `📋 Rôles autorisés (${currentRoles.length})`,
      value: rolesList,
      inline: false
    });
  }

  // Ce que peuvent faire les admins
  embed.addFields({
    name: '🔧 Fonctionnalités accessibles',
    value: '• Créer et gérer les **thèmes** de collection\n' +
           '• Lancer des **mystery boxes** et **gives**\n' +
           '• Configurer les **missions** et **récompenses**\n' +
           '• Gérer les **campagnes** automatisées',
    inline: false
  });

  // Select menu pour les rôles (multi-select)
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('setup_role_select')
    .setPlaceholder('🎭 Sélectionner les rôles ayant accès à l\'admin panel')
    .setMinValues(0)
    .setMaxValues(25); // Discord limit

  const row1 = new ActionRowBuilder().addComponents(roleSelect);

  // Boutons
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_validate_roles')
      .setLabel('✅ Valider et Continuer')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup_reset_roles')
      .setLabel('🗑️ Réinitialiser les Rôles')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('setup_skip_to_checklist')
      .setLabel('➡️ Passer au Checklist')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row1, row2]
  });
}

/**
 * ÉTAPE 2: Afficher le checklist des prérequis
 */
async function showPrerequisitesChecklist(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🛠️ Configuration Initiale - Étape 3/3')
    .setDescription(
      '# Checklist des Prérequis\n\n' +
      '✅ **Rôles admin configurés**\n' +
      '✅ **Thème sélectionné** (si vous avez choisi un preset)\n\n' +
      '**Finalisez la configuration via `/admin-panel`:**\n\n' +
      '## 📌 1. Vérifier/Créer un Thème\n' +
      '• Si vous avez importé un thème → Il est déjà actif !\n' +
      '• Sinon → `/admin-panel` → **Thèmes** → **Créer un Thème**\n\n' +
      '## 📝 2. Vérifier le Contenu (si thème personnalisé)\n' +
      '• **Mission "Mot Deviné":**\n' +
      '  → Ajoutez 3-5 mots-clés **spécifiques au thème**\n' +
      '  → Exemple thème Monopoly: "chance", "prison", "gare"\n' +
      '  → Via: Missions → Mot Deviné → Gérer Mots-Clés\n\n' +
      '• **Mission "Quiz":**\n' +
      '  → Ajoutez 3-5 questions **en rapport avec le thème**\n' +
      '  → Exemple: "Combien de gares y a-t-il ?"\n' +
      '  → Via: Missions → Quiz → Gérer Questions\n\n' +
      '## 🎁 3. Créer des Collectibles (CRITIQUE)\n' +
      '• Minimum **5-7 collectibles** pour le thème\n' +
      '• Nom, rareté (Commun, Rare, Épique, Légendaire), image URL\n' +
      '• Via: Collectibles → Créer un Collectible\n\n' +
      '## 📢 4. Configurer les Canaux de Give (CRITIQUE)\n' +
      '• Définir où les mystery boxes apparaîtront\n' +
      '• Choisir entre:\n' +
      '  → Catégories de canaux (tous les canaux textuels)\n' +
      '  → Canaux spécifiques\n' +
      '• Via: Canaux Give → Configurer Canaux\n\n' +
      '## ⚙️ 5. Configuration Optionnelle\n' +
      '• **Canal d\'annonces:** Pour les annonces système (missions, collections)\n' +
      '  → Via: Configuration → Canal d\'Annonces\n\n' +
      '• **Templates d\'annonces:** Personnaliser les messages\n' +
      '  → Via: Annonces → Gérer Templates\n\n' +
      '• **Timeouts missions:** Ajuster les délais (défaut: 60s)\n' +
      '  → Via: Missions → [Mission] → Configurer Timeout\n\n' +
      '• **Nombre d\'essais Quiz:** Limiter les tentatives (défaut: illimité)\n' +
      '  → Via: Missions → Quiz → Nombre d\'essais\n\n' +
      '---\n\n' +
      '💡 **Une fois ces étapes complétées, votre serveur est prêt !**\n\n' +
      'Vous pourrez ensuite:\n' +
      '• Lancer des **Give Unique** (admin)\n' +
      '• Créer des **Campagnes** programmées\n' +
      '• Les joueurs pourront utiliser `/profile`, `/leaderboard`'
    )
    .setColor('#2ecc71')
    .setFooter({ text: 'Accédez au panneau admin avec /admin-panel' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_back_to_roles')
      .setLabel('← Rôles')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_theme_back')
      .setLabel('← Thèmes')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_finish')
      .setLabel('✅ Terminer')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

module.exports.showRoleConfiguration = showRoleConfiguration;
module.exports.showPrerequisitesChecklist = showPrerequisitesChecklist;
