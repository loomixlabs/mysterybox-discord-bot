/**
 * AUDIT FINAL EXPERT: Config Bot - Toutes les possibilités de configuration
 *
 * Ce script génère un rapport exhaustif de TOUT ce qui peut être configuré
 * dans l'onglet "Config Bot" du Theme Builder.
 */

const db = require('../utils/database-pg');

async function auditConfigBotFinal() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        AUDIT FINAL EXPERT: CONFIG BOT                                  ║');
  console.log('║                   Toutes les possibilités de configuration                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const report = {
    sections: [],
    tables: [],
    totalFields: 0
  };

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SECTION 1: BRANDING & PERSONNALISATION
  // Table: guild_branding
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SECTION 1: 🎨 BRANDING & PERSONNALISATION');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const brandingColumns = await db.queryAll(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'guild_branding'
    ORDER BY ordinal_position
  `);

  console.log('📊 Table: guild_branding');
  console.log('   Champs configurables:\n');

  const brandingFields = brandingColumns.filter(c =>
    !['id', 'created_at', 'updated_at'].includes(c.column_name)
  );

  brandingFields.forEach(col => {
    const icon = col.column_name.includes('color') ? '🎨' :
                 col.column_name.includes('name') ? '🏷️' :
                 col.column_name.includes('status') ? '🎭' :
                 col.column_name.includes('footer') ? '📝' :
                 col.column_name.includes('timezone') ? '🕐' :
                 col.column_name.includes('language') ? '🌐' :
                 col.column_name.includes('modules') ? '🔧' : '⚙️';

    console.log(`   ${icon} ${col.column_name}`);
    console.log(`      Type: ${col.data_type}`);
    if (col.column_default) console.log(`      Default: ${col.column_default.substring(0, 50)}`);
    console.log('');
  });

  report.sections.push({
    name: 'Branding & Personnalisation',
    table: 'guild_branding',
    fields: brandingFields.map(c => c.column_name),
    description: 'Personnalisation visuelle du bot (nom, couleurs, footer, statut)'
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SECTION 2: NOTIFICATIONS / TOGGLES
  // Table: announcement_settings
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SECTION 2: 🔔 NOTIFICATIONS / TOGGLES');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const announcementColumns = await db.queryAll(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'announcement_settings'
    ORDER BY ordinal_position
  `);

  console.log('📊 Table: announcement_settings');
  console.log('   Toggles on/off pour les annonces:\n');

  const toggleFields = announcementColumns.filter(c =>
    !['id', 'guild_id', 'theme_id', 'created_at', 'updated_at'].includes(c.column_name)
  );

  // Grouper par catégorie
  const toggleCategories = {
    'Collectibles': toggleFields.filter(c => c.column_name.includes('collectible') || c.column_name.includes('collection')),
    'Missions': toggleFields.filter(c => c.column_name.includes('mission')),
    'Pièges': toggleFields.filter(c => c.column_name.includes('trap')),
    'Super Bonus': toggleFields.filter(c => c.column_name.includes('bonus')),
    'Thèmes': toggleFields.filter(c => c.column_name.includes('theme'))
  };

  for (const [category, fields] of Object.entries(toggleCategories)) {
    if (fields.length > 0) {
      console.log(`   📌 ${category}:`);
      fields.forEach(col => {
        const defaultVal = col.column_default === 'true' ? '✅ ON' : '❌ OFF';
        console.log(`      ☑️  ${col.column_name} (${defaultVal} par défaut)`);
      });
      console.log('');
    }
  }

  report.sections.push({
    name: 'Notifications / Toggles',
    table: 'announcement_settings',
    fields: toggleFields.map(c => c.column_name),
    categories: toggleCategories,
    description: 'Activation/désactivation des annonces par type'
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SECTION 3: CONFIGURATION GÉNÉRALE DU SERVEUR
  // Table: guild_config
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SECTION 3: ⚙️ CONFIGURATION GÉNÉRALE');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const guildConfigColumns = await db.queryAll(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'guild_config'
    ORDER BY ordinal_position
  `);

  console.log('📊 Table: guild_config');
  console.log('   Configuration globale du serveur:\n');

  const configFields = guildConfigColumns.filter(c =>
    !['id', 'created_at', 'updated_at'].includes(c.column_name)
  );

  // Grouper par type
  const configCategories = {
    'Identification': configFields.filter(c => ['guild_id', 'guild_name', 'owner_id'].includes(c.column_name)),
    'Statut': configFields.filter(c => ['is_active', 'is_trial', 'is_premium'].includes(c.column_name)),
    'Rôles': configFields.filter(c => c.column_name.includes('role')),
    'Notifications Thread': configFields.filter(c => c.column_name.includes('notify')),
    'Premium': configFields.filter(c => c.column_name.includes('premium') || c.column_name.includes('trial')),
    'Dates': configFields.filter(c => c.column_name.includes('_at'))
  };

  for (const [category, fields] of Object.entries(configCategories)) {
    if (fields.length > 0) {
      console.log(`   📌 ${category}:`);
      fields.forEach(col => {
        console.log(`      • ${col.column_name} (${col.data_type})`);
      });
      console.log('');
    }
  }

  report.sections.push({
    name: 'Configuration Générale',
    table: 'guild_config',
    fields: configFields.map(c => c.column_name),
    description: 'Paramètres globaux du serveur (rôles, notifications, premium)'
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SECTION 4: CAMPAGNES AUTOMATIQUES
  // Tables: give_campaigns, give_channels
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SECTION 4: 📢 CAMPAGNES AUTOMATIQUES');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const campaignColumns = await db.queryAll(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'give_campaigns'
    ORDER BY ordinal_position
  `);

  console.log('📊 Table: give_campaigns');
  console.log('   Campagnes de distribution automatique:\n');

  campaignColumns.forEach(col => {
    const icon = col.column_name.includes('cron') ? '⏰' :
                 col.column_name.includes('status') ? '📊' :
                 col.column_name.includes('channel') ? '📺' :
                 col.column_name.includes('count') ? '🔢' : '•';
    console.log(`   ${icon} ${col.column_name} (${col.data_type})`);
  });

  // Vérifier give_channels aussi
  const channelColumns = await db.queryAll(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'give_channels'
    ORDER BY ordinal_position
  `);

  if (channelColumns.length > 0) {
    console.log('\n📊 Table: give_channels');
    console.log('   Canaux associés aux campagnes:\n');
    channelColumns.forEach(col => {
      console.log(`   • ${col.column_name} (${col.data_type})`);
    });
  }

  report.sections.push({
    name: 'Campagnes Automatiques',
    tables: ['give_campaigns', 'give_channels'],
    description: 'Création et gestion des distributions automatiques'
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SECTION 5: GESTION DES JOUEURS (Actions)
  // Tables liées: players, collections, player_progress
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SECTION 5: 👥 GESTION DES JOUEURS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const playerCount = await db.queryOne('SELECT COUNT(*) as total FROM players');
  const collectionCount = await db.queryOne('SELECT COUNT(*) as total FROM collections');

  console.log('📊 Statistiques actuelles:');
  console.log(`   • ${playerCount.total} joueurs enregistrés`);
  console.log(`   • ${collectionCount.total} items collectés\n`);

  console.log('🎮 Actions disponibles:');
  console.log('   • Voir la liste des joueurs avec stats');
  console.log('   • Rechercher un joueur');
  console.log('   • Reset progression d\'un joueur');
  console.log('   • Voir l\'inventaire d\'un joueur');
  console.log('   • Donner/Retirer des items');
  console.log('   • Voir l\'historique des actions (give_logs)');

  report.sections.push({
    name: 'Gestion des Joueurs',
    tables: ['players', 'collections', 'player_progress', 'give_logs'],
    description: 'Administration des joueurs et leurs données'
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SECTION 6: STATISTIQUES & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SECTION 6: 📊 STATISTIQUES & ANALYTICS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Vérifier si guild_stats existe
  const guildStatsExists = await db.queryOne(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'guild_stats'
    ) as exists
  `);

  if (guildStatsExists.exists) {
    const statsColumns = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'guild_stats'
      ORDER BY ordinal_position
    `);

    console.log('📊 Table: guild_stats');
    statsColumns.forEach(col => {
      console.log(`   • ${col.column_name} (${col.data_type})`);
    });
  }

  console.log('\n📈 Métriques calculables:');
  console.log('   • Nombre de joueurs actifs');
  console.log('   • Collectibles distribués (par rareté)');
  console.log('   • Missions complétées/échouées');
  console.log('   • Pièges déclenchés');
  console.log('   • Super bonus utilisés');
  console.log('   • Progression moyenne des joueurs');

  report.sections.push({
    name: 'Statistiques & Analytics',
    description: 'Dashboard de statistiques et métriques du serveur'
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SECTION 7: RÔLES ADMIN
  // Table: guild_admin_roles
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SECTION 7: 👑 RÔLES ADMINISTRATEURS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const adminRolesExists = await db.queryOne(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'guild_admin_roles'
    ) as exists
  `);

  if (adminRolesExists.exists) {
    const adminRolesColumns = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'guild_admin_roles'
      ORDER BY ordinal_position
    `);

    console.log('📊 Table: guild_admin_roles');
    console.log('   Rôles ayant accès au panel admin:\n');
    adminRolesColumns.forEach(col => {
      console.log(`   • ${col.column_name} (${col.data_type})`);
    });

    const adminRolesCount = await db.queryOne('SELECT COUNT(*) as total FROM guild_admin_roles');
    console.log(`\n   📝 ${adminRolesCount.total} rôle(s) configuré(s)`);
  }

  console.log('\n🔐 Permissions configurables:');
  console.log('   • Ajouter/Retirer des rôles admin');
  console.log('   • Définir le rôle co-fondateur');
  console.log('   • Gérer les accès au panel');

  report.sections.push({
    name: 'Rôles Administrateurs',
    table: 'guild_admin_roles',
    description: 'Gestion des rôles ayant accès aux fonctions admin'
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // SECTION 8: BADGES & RÉCOMPENSES
  // Tables: badges, player_badges, badge_progress
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  SECTION 8: 🏅 BADGES & RÉCOMPENSES');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const badgesCount = await db.queryOne('SELECT COUNT(*) as total FROM badges');
  console.log(`📊 ${badgesCount.total} badges disponibles dans le système\n`);

  console.log('🎖️ Fonctionnalités:');
  console.log('   • Voir tous les badges disponibles');
  console.log('   • Statistiques d\'attribution par badge');
  console.log('   • Créer des badges personnalisés (future)');

  report.sections.push({
    name: 'Badges & Récompenses',
    tables: ['badges', 'player_badges', 'badge_progress'],
    description: 'Système de badges et récompenses'
  });

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // RÉSUMÉ FINAL
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              RÉSUMÉ FINAL                                              ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                                        ║');
  console.log('║  📌 SECTIONS IDENTIFIÉES POUR CONFIG BOT:                                              ║');
  console.log('║                                                                                        ║');
  console.log('║  1️⃣  BRANDING          - Nom, couleurs, footer, statut, langue, timezone              ║');
  console.log('║  2️⃣  NOTIFICATIONS     - 20+ toggles pour les annonces (collectibles, missions, etc)  ║');
  console.log('║  3️⃣  CONFIGURATION     - Rôles admin, notifications thread, premium                   ║');
  console.log('║  4️⃣  CAMPAGNES         - Création/gestion des distributions automatiques              ║');
  console.log('║  5️⃣  JOUEURS           - Liste, recherche, reset, inventaire, historique              ║');
  console.log('║  6️⃣  STATISTIQUES      - Dashboard analytics du serveur                               ║');
  console.log('║  7️⃣  RÔLES ADMIN       - Gestion des accès au panel                                   ║');
  console.log('║  8️⃣  BADGES            - Visualisation des badges (lecture seule)                     ║');
  console.log('║                                                                                        ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                                        ║');
  console.log('║  📊 TABLES PRINCIPALES:                                                                ║');
  console.log('║     • guild_branding (personnalisation)                                                ║');
  console.log('║     • announcement_settings (toggles)                                                  ║');
  console.log('║     • guild_config (config globale)                                                    ║');
  console.log('║     • guild_admin_roles (permissions)                                                  ║');
  console.log('║     • give_campaigns + give_channels (campagnes)                                       ║');
  console.log('║     • players + collections + player_progress (joueurs)                                ║');
  console.log('║     • badges + player_badges (badges)                                                  ║');
  console.log('║                                                                                        ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                                        ║');
  console.log('║  ⚠️  TABLES EXCLUES (Super Admin / Thèmes):                                            ║');
  console.log('║     • super_admins, super_admin_logs, super_bonuses (onglet dédié)                     ║');
  console.log('║     • themes, theme_config, collectibles, traps, missions (Theme Builder)             ║');
  console.log('║                                                                                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════════╝');

  console.log('\n');
  process.exit(0);
}

auditConfigBotFinal().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
