/**
 * AUDIT EXPERT: Possibilités de configuration du bot (Config Bot)
 *
 * Objectif: Identifier TOUTES les tables et colonnes configurables
 * pour l'onglet "Config Bot" du Theme Builder (mode DB).
 *
 * Exclusions:
 * - Tables liées aux thèmes (gérées dans Theme Builder)
 * - Tables super_admin (onglet dédié)
 * - Tables de données joueurs (pas de config)
 */

const db = require('../utils/database-pg');

async function auditConfigBotPossibilities() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT EXPERT: CONFIG BOT POSSIBILITIES                    ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║  Analyse exhaustive des tables configurables par guild                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1: Lister TOUTES les tables de la base de données
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  ÉTAPE 1: INVENTAIRE COMPLET DES TABLES');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const allTables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`📊 ${allTables.length} tables trouvées:\n`);

    // Catégoriser les tables
    const categories = {
      config: [],           // Tables de configuration (CIBLE)
      theme: [],            // Tables liées aux thèmes (Theme Builder)
      player: [],           // Tables joueurs (données, pas config)
      superAdmin: [],       // Tables super admin (onglet dédié)
      system: [],           // Tables système/logs
      other: []             // Autres
    };

    for (const { table_name } of allTables) {
      if (['super_admins', 'super_admin_logs', 'super_bonuses', 'super_bonus_usage_history'].includes(table_name)) {
        categories.superAdmin.push(table_name);
      } else if (['themes', 'theme_config', 'theme_messages', 'collectibles', 'traps', 'missions',
                  'mission_keywords', 'quiz_questions', 'announcement_templates', 'themes_library'].includes(table_name)) {
        categories.theme.push(table_name);
      } else if (['players', 'player_progress', 'collections', 'player_active_bonuses',
                  'player_cooldowns', 'player_malus_points', 'mission_progress', 'trap_triggered'].includes(table_name)) {
        categories.player.push(table_name);
      } else if (['audit_logs', 'give_logs', 'theme_builder_logs', 'activity_logs'].includes(table_name)) {
        categories.system.push(table_name);
      } else if (['guild_config', 'announcement_settings', 'give_campaigns', 'give_channels',
                  'progression_roles', 'colors', 'badges', 'player_badges'].includes(table_name)) {
        categories.config.push(table_name);
      } else {
        categories.other.push(table_name);
      }
    }

    console.log('📁 CATÉGORISATION DES TABLES:\n');
    console.log('   🎯 CONFIG (cible pour Config Bot):');
    categories.config.forEach(t => console.log(`      - ${t}`));
    console.log('');
    console.log('   🎨 THEME (géré par Theme Builder):');
    categories.theme.forEach(t => console.log(`      - ${t}`));
    console.log('');
    console.log('   👤 PLAYER (données joueurs):');
    categories.player.forEach(t => console.log(`      - ${t}`));
    console.log('');
    console.log('   👑 SUPER ADMIN (onglet dédié):');
    categories.superAdmin.forEach(t => console.log(`      - ${t}`));
    console.log('');
    console.log('   📋 SYSTEM (logs):');
    categories.system.forEach(t => console.log(`      - ${t}`));
    console.log('');
    console.log('   ❓ OTHER (à analyser):');
    categories.other.forEach(t => console.log(`      - ${t}`));

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2: Analyse détaillée des tables de configuration
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  ÉTAPE 2: ANALYSE DÉTAILLÉE DES TABLES DE CONFIGURATION');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const configTables = [...categories.config, ...categories.other];
    const tableAnalysis = {};

    for (const tableName of configTables) {
      console.log(`\n📊 TABLE: ${tableName}`);
      console.log('─'.repeat(60));

      // Structure de la table
      const columns = await db.queryAll(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      tableAnalysis[tableName] = {
        columns: columns,
        hasGuildId: columns.some(c => c.column_name === 'guild_id'),
        sample: null
      };

      console.log('   Colonnes:');
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)';
        const defaultVal = col.column_default ? ` [default: ${col.column_default.substring(0, 30)}]` : '';
        console.log(`      - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
      });

      // Exemple de données
      try {
        const sample = await db.queryAll(`SELECT * FROM ${tableName} LIMIT 2`);
        tableAnalysis[tableName].sample = sample;
        if (sample.length > 0) {
          console.log(`   Exemple (${sample.length} row(s)):`);
          console.log(`      ${JSON.stringify(sample[0], null, 2).split('\n').join('\n      ')}`);
        } else {
          console.log('   ⚠️  Table vide');
        }
      } catch (e) {
        console.log(`   ❌ Erreur lecture: ${e.message}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 3: Analyse de guild_config (table principale)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  ÉTAPE 3: ANALYSE APPROFONDIE DE GUILD_CONFIG');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const guildConfigData = await db.queryAll(`
      SELECT * FROM guild_config ORDER BY guild_id
    `);

    console.log(`📊 ${guildConfigData.length} guild(s) configurée(s):\n`);

    for (const config of guildConfigData) {
      console.log(`\n   🏠 Guild: ${config.guild_id} (${config.guild_name || 'sans nom'})`);
      console.log('   ─'.repeat(40));
      Object.entries(config).forEach(([key, value]) => {
        if (key !== 'guild_id' && key !== 'guild_name') {
          const displayValue = value === null ? 'null' :
                              typeof value === 'object' ? JSON.stringify(value) :
                              String(value).substring(0, 50);
          console.log(`      ${key}: ${displayValue}`);
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 4: Analyse de announcement_settings
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  ÉTAPE 4: ANALYSE DE ANNOUNCEMENT_SETTINGS (toggles)');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const announcementSettings = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      ORDER BY ordinal_position
    `);

    console.log('📊 Colonnes de announcement_settings (toggles on/off):\n');
    const toggleColumns = announcementSettings.filter(c =>
      !['id', 'guild_id', 'theme_id', 'created_at', 'updated_at'].includes(c.column_name)
    );

    toggleColumns.forEach(col => {
      console.log(`   ☑️  ${col.column_name} (${col.data_type}) - default: ${col.column_default}`);
    });

    // Données existantes
    const existingSettings = await db.queryAll(`SELECT * FROM announcement_settings LIMIT 3`);
    if (existingSettings.length > 0) {
      console.log('\n   Exemple de configuration:');
      const sample = existingSettings[0];
      toggleColumns.forEach(col => {
        const value = sample[col.column_name];
        const icon = value ? '✅' : '❌';
        console.log(`      ${icon} ${col.column_name}: ${value}`);
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 5: Analyse des campagnes (give_campaigns)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  ÉTAPE 5: ANALYSE DES CAMPAGNES (give_campaigns)');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const campaignColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'give_campaigns'
      ORDER BY ordinal_position
    `);

    console.log('📊 Structure de give_campaigns:\n');
    campaignColumns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    const campaigns = await db.queryAll(`
      SELECT gc.*,
             (SELECT COUNT(*) FROM give_channels gch WHERE gch.campaign_id = gc.id) as channel_count
      FROM give_campaigns gc
      ORDER BY gc.guild_id, gc.created_at DESC
    `);

    console.log(`\n📋 ${campaigns.length} campagne(s) trouvée(s):`);
    for (const camp of campaigns) {
      console.log(`\n   📢 Campagne #${camp.id}: ${camp.name || 'Sans nom'}`);
      console.log(`      Guild: ${camp.guild_id}`);
      console.log(`      Status: ${camp.status}`);
      console.log(`      Type: ${camp.campaign_type}`);
      console.log(`      Canaux: ${camp.channel_count}`);
      console.log(`      Cron: ${camp.cron_expression || 'N/A'}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 6: Analyse des rôles de progression (hors thème)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  ÉTAPE 6: ANALYSE DES TABLES "OTHER" (à catégoriser)');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    for (const tableName of categories.other) {
      const columns = await db.queryAll(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const count = await db.queryOne(`SELECT COUNT(*) as total FROM ${tableName}`);

      console.log(`\n📊 ${tableName} (${count.total} rows)`);
      console.log('   Colonnes: ' + columns.map(c => c.column_name).join(', '));

      // Déterminer si c'est une table de config
      const hasGuildId = columns.some(c => c.column_name === 'guild_id');
      const isConfig = hasGuildId && !columns.some(c => c.column_name === 'player_id');
      console.log(`   Has guild_id: ${hasGuildId ? 'OUI' : 'NON'}`);
      console.log(`   Semble être config: ${isConfig ? 'OUI ✅' : 'NON'}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÉTAPE 7: RÉSUMÉ - Ce qui peut être configuré dans "Config Bot"
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    RÉSUMÉ: FONCTIONNALITÉS "CONFIG BOT"                      ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('🎯 SECTIONS IDENTIFIÉES POUR CONFIG BOT:\n');

    console.log('   1️⃣  CONFIGURATION GÉNÉRALE (guild_config)');
    console.log('      ├─ Canal d\'annonces (announcement_channel_id)');
    console.log('      ├─ Rôle Bot (bot_role_id)');
    console.log('      ├─ Statut du bot (bot_status, bot_status_type, bot_status_text)');
    console.log('      ├─ Webhook URL');
    console.log('      └─ Premium settings');
    console.log('');

    console.log('   2️⃣  NOTIFICATIONS / ANNONCES (announcement_settings)');
    console.log('      ├─ Toggle collectible trouvé');
    console.log('      ├─ Toggle piège déclenché');
    console.log('      ├─ Toggle mission démarrée/complétée/échouée');
    console.log('      ├─ Toggle super bonus');
    console.log('      └─ Toggle progression/rôle final');
    console.log('');

    console.log('   3️⃣  CAMPAGNES AUTOMATIQUES (give_campaigns + give_channels)');
    console.log('      ├─ Création/édition de campagnes');
    console.log('      ├─ Configuration CRON');
    console.log('      ├─ Sélection des canaux');
    console.log('      └─ Activation/désactivation');
    console.log('');

    console.log('   4️⃣  GESTION DES JOUEURS (lecture seule + actions)');
    console.log('      ├─ Liste des joueurs avec stats');
    console.log('      ├─ Reset d\'un joueur');
    console.log('      ├─ Bannir/débannir');
    console.log('      └─ Voir historique (give_logs)');
    console.log('');

    console.log('   5️⃣  STATISTIQUES (lecture seule)');
    console.log('      ├─ Nombre de joueurs');
    console.log('      ├─ Collectibles distribués');
    console.log('      ├─ Missions complétées');
    console.log('      └─ Pièges déclenchés');
    console.log('');

    console.log('   6️⃣  COULEURS PERSONNALISÉES (colors - si par guild)');
    console.log('      └─ Palette de couleurs pour embeds');
    console.log('');

    console.log('   7️⃣  BADGES (badges - lecture)');
    console.log('      └─ Liste des badges disponibles');

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('  FIN DE L\'AUDIT');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

auditConfigBotPossibilities();
