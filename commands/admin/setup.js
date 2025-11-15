const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const permissions = require('../../utils/permissions');

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

  let rolesDescription = '';
  if (currentRoles.length === 0) {
    rolesDescription = '📋 **Aucun rôle configuré actuellement**\n\n' +
                       '⚠️ Tant qu\'aucun rôle n\'est configuré, seul le propriétaire du serveur peut accéder à `/admin-panel`.\n\n' +
                       '💡 Utilisez le menu ci-dessous pour sélectionner les rôles qui auront accès.';
  } else {
    rolesDescription = '📋 **Rôles actuellement configurés:**\n\n';
    for (const roleData of currentRoles) {
      const role = interaction.guild.roles.cache.get(roleData.role_id);
      if (role) {
        rolesDescription += `• ${role.name}\n`;
      } else {
        rolesDescription += `• ~~Rôle supprimé~~ (${roleData.role_id})\n`;
      }
    }
    rolesDescription += '\n💡 Modifiez la sélection ci-dessous pour ajouter ou retirer des rôles.';
  }

  const embed = new EmbedBuilder()
    .setTitle('🛠️ Configuration Initiale - Étape 1/2')
    .setDescription(
      '# Configuration des Rôles Admin\n\n' +
      rolesDescription + '\n\n' +
      '**Hiérarchie des permissions:**\n' +
      '1️⃣ **Super Admins** (hardcodés) → Accès à TOUS les serveurs\n' +
      '2️⃣ **Propriétaire du serveur** → Accès automatique\n' +
      '3️⃣ **Rôles configurés** → Accès selon votre sélection ci-dessous'
    )
    .setColor('#3498db')
    .setFooter({ text: 'Sélectionnez les rôles puis cliquez sur "Valider"' })
    .setTimestamp();

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
    .setTitle('🛠️ Configuration Initiale - Étape 2/2')
    .setDescription(
      '# Checklist des Prérequis\n\n' +
      '✅ **Rôles admin configurés** (Vous venez de le faire)\n\n' +
      '**Maintenant, configurez votre serveur via `/admin-panel`:**\n\n' +
      '## 📌 1. Créer un Thème (CRITIQUE)\n' +
      '• Utilisez `/admin-panel` → **Thèmes** → **Créer un Thème**\n' +
      '• Nom du thème (ex: "Monopoly Friends", "Pokémon", "Harry Potter")\n' +
      '• Nombre d\'items requis pour compléter la collection (recommandé: 7)\n' +
      '• Rôle de complétion (optionnel mais recommandé)\n' +
      '• Date d\'expiration (optionnel)\n\n' +
      '⚠️ **2 missions sont créées automatiquement mais VIDES:**\n' +
      '• Mission "Mot Deviné" (keyword-message)\n' +
      '• Mission "Quiz" (quiz)\n\n' +
      '## 📝 2. Ajouter du Contenu aux Missions (CRITIQUE)\n' +
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
      .setLabel('← Modifier les Rôles')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_finish')
      .setLabel('✅ Terminer la Configuration')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

module.exports.showRoleConfiguration = showRoleConfiguration;
module.exports.showPrerequisitesChecklist = showPrerequisitesChecklist;
