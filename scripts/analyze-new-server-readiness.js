const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

/**
 * 🔍 ANALYSE COMPLÈTE POUR DÉPLOIEMENT NOUVEAU SERVEUR
 *
 * Ce script vérifie tous les systèmes critiques pour s'assurer
 * que le bot sera 100% opérationnel sur un nouveau serveur.
 */

async function analyzeNewServerReadiness() {
  console.log('\n' + '='.repeat(100));
  console.log('🔍 ANALYSE COMPLÈTE - PRÉPARATION DÉPLOIEMENT NOUVEAU SERVEUR');
  console.log('='.repeat(100) + '\n');

  const report = {
    timestamp: new Date().toISOString(),
    checks: [],
    warnings: [],
    errors: [],
    summary: {}
  };

  try {
    // ========================================
    // 1. VÉRIFICATION STRUCTURE BASE DE DONNÉES
    // ========================================
    console.log('📊 SECTION 1: STRUCTURE BASE DE DONNÉES\n');
    console.log('='.repeat(100));

    const requiredTables = [
      // Configuration
      'themes', 'collectibles', 'traps', 'theme_messages', 'theme_config',
      'guild_config', 'announcement_settings', 'announcement_templates',
      // Joueurs
      'players', 'player_progress', 'collections', 'player_active_bonuses',
      'player_cooldowns', 'player_malus_points',
      // Missions
      'missions', 'mission_progress', 'mission_keywords',
      // Campagnes
      'give_campaigns', 'give_channels', 'give_logs',
      // Super Admin
      'super_admins', 'super_bonuses', 'super_admin_logs',
      // Badges
      'badges', 'player_badges',
      // Autres
      'audit_logs', 'trap_triggered'
    ];

    const existingTables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const existingTableNames = existingTables.map(t => t.table_name);
    const missingTables = requiredTables.filter(t => !existingTableNames.includes(t));

    console.log(`✅ Tables existantes: ${existingTableNames.length}`);
    console.log(`📋 Tables requises: ${requiredTables.length}`);

    if (missingTables.length > 0) {
      console.log(`❌ Tables manquantes: ${missingTables.length}`);
      console.log(`   ${missingTables.join(', ')}`);
      report.errors.push({
        section: 'Database Structure',
        issue: 'Missing tables',
        details: missingTables
      });
    } else {
      console.log(`✅ Toutes les tables requises sont présentes`);
      report.checks.push({
        section: 'Database Structure',
        status: 'OK',
        details: `${requiredTables.length} tables présentes`
      });
    }

    // Vérifier les colonnes critiques multi-serveur (guild_id)
    console.log('\n📋 Vérification isolation multi-serveur (guild_id)...\n');

    const tablesNeedingGuildId = [
      'themes', 'collectibles', 'traps', 'theme_messages', 'theme_config',
      'guild_config', 'announcement_settings', 'announcement_templates',
      'players', 'player_progress', 'collections', 'player_active_bonuses',
      'player_cooldowns', 'player_malus_points',
      'missions', 'mission_progress', 'mission_keywords',
      'give_campaigns', 'give_channels', 'give_logs',
      'audit_logs', 'trap_triggered', 'player_badges', 'super_bonuses'
    ];

    let guildIdIssues = 0;
    for (const table of tablesNeedingGuildId) {
      const hasGuildId = await db.queryOne(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = $1
            AND column_name = 'guild_id'
        ) as has_guild_id
      `, [table]);

      if (!hasGuildId.has_guild_id) {
        console.log(`   ❌ ${table}: Colonne guild_id MANQUANTE`);
        guildIdIssues++;
        report.errors.push({
          section: 'Multi-Server Isolation',
          issue: `Table ${table} missing guild_id column`,
          impact: 'CRITICAL - Multi-server support broken'
        });
      }
    }

    if (guildIdIssues === 0) {
      console.log(`✅ Toutes les tables ont la colonne guild_id`);
      report.checks.push({
        section: 'Multi-Server Isolation',
        status: 'OK',
        details: 'guild_id présent dans toutes les tables critiques'
      });
    } else {
      console.log(`❌ ${guildIdIssues} table(s) sans guild_id`);
    }

    // ========================================
    // 2. VÉRIFICATION SYSTÈMES PAR DÉFAUT
    // ========================================
    console.log('\n\n📦 SECTION 2: SYSTÈMES PAR DÉFAUT\n');
    console.log('='.repeat(100));

    // 2.1 Super Bonuses
    console.log('\n🎁 2.1 SUPER BONUSES\n');
    const superBonuses = await db.queryAll(`
      SELECT id, name, bonus_id, bonus_type, rarity, effect_type, activation_mode, guild_id
      FROM super_bonuses
      ORDER BY bonus_id
    `);

    console.log(`📊 Total Super Bonuses: ${superBonuses.length}`);

    if (superBonuses.length === 0) {
      console.log(`❌ CRITIQUE: Aucun super bonus configuré`);
      report.errors.push({
        section: 'Super Bonuses',
        issue: 'No super bonuses configured',
        impact: 'CRITICAL - System non-functional'
      });
    } else {
      // Compter par serveur
      const byGuild = {};
      superBonuses.forEach(sb => {
        byGuild[sb.guild_id] = (byGuild[sb.guild_id] || 0) + 1;
      });

      console.log(`📊 Bonus par serveur:`);
      Object.entries(byGuild).forEach(([guildId, count]) => {
        console.log(`   ${guildId}: ${count} bonus`);
      });

      // Afficher un échantillon des bonus
      const sample = superBonuses.slice(0, 10);
      console.table(sample.map(sb => ({
        ID: sb.bonus_id,
        Nom: sb.name,
        Type: sb.bonus_type,
        Rareté: sb.rarity,
        Effet: sb.effect_type,
        Mode: sb.activation_mode
      })));

      // Vérifier les bonus critiques (IDs texte)
      const criticalBonusIds = ['1', '2', '3', '9', '14', '15', '16'];
      const existingBonusIds = superBonuses.map(sb => sb.bonus_id);
      const missingCritical = criticalBonusIds.filter(id => !existingBonusIds.includes(id));

      if (missingCritical.length > 0) {
        console.log(`⚠️  Bonus critiques manquants: ${missingCritical.join(', ')}`);
        report.warnings.push({
          section: 'Super Bonuses',
          issue: 'Missing critical bonuses',
          details: missingCritical
        });
      } else {
        console.log(`✅ Tous les bonus critiques présents`);
      }

      report.checks.push({
        section: 'Super Bonuses',
        status: 'OK',
        details: `${superBonuses.length} bonus configurés sur ${Object.keys(byGuild).length} serveur(s)`
      });
    }

    // 2.2 Badges
    console.log('\n\n🏆 2.2 BADGES\n');
    const badges = await db.queryAll(`
      SELECT category, rarity, COUNT(*) as count
      FROM badges
      GROUP BY category, rarity
      ORDER BY category, rarity
    `);

    console.log(`📊 Total Badges: ${badges.reduce((sum, b) => sum + parseInt(b.count), 0)}`);

    if (badges.length === 0) {
      console.log(`⚠️  Aucun badge configuré`);
      report.warnings.push({
        section: 'Badges',
        issue: 'No badges configured',
        impact: 'Feature incomplete but not critical'
      });
    } else {
      console.table(badges);
      report.checks.push({
        section: 'Badges',
        status: 'OK',
        details: `${badges.reduce((sum, b) => sum + parseInt(b.count), 0)} badges`
      });
    }

    // 2.3 Missions Types
    console.log('\n\n🎯 2.3 MISSIONS\n');
    const missionTypes = await db.queryAll(`
      SELECT type, COUNT(*) as count
      FROM missions
      GROUP BY type
      ORDER BY type
    `);

    console.log(`📊 Types de missions configurés: ${missionTypes.length}`);

    if (missionTypes.length === 0) {
      console.log(`❌ CRITIQUE: Aucune mission configurée`);
      report.errors.push({
        section: 'Missions',
        issue: 'No missions configured',
        impact: 'CRITICAL - Mission system non-functional'
      });
    } else {
      console.table(missionTypes);

      const requiredTypes = ['quiz', 'keyword-message', 'channel-activity'];
      const existingTypes = missionTypes.map(mt => mt.type);
      const missingTypes = requiredTypes.filter(t => !existingTypes.includes(t));

      if (missingTypes.length > 0) {
        console.log(`⚠️  Types de missions manquants: ${missingTypes.join(', ')}`);
        report.warnings.push({
          section: 'Missions',
          issue: 'Missing mission types',
          details: missingTypes
        });
      } else {
        report.checks.push({
          section: 'Missions',
          status: 'OK',
          details: `${missionTypes.length} types configurés`
        });
      }
    }

    // ========================================
    // 3. CHECKLIST NOUVEAU SERVEUR
    // ========================================
    console.log('\n\n📋 SECTION 3: CHECKLIST NOUVEAU SERVEUR\n');
    console.log('='.repeat(100));

    const checklist = [
      {
        step: '1',
        action: 'Inviter le bot sur le serveur',
        method: 'Discord Developer Portal → OAuth2 → Permissions: Administrator',
        required: true
      },
      {
        step: '2',
        action: 'Créer la configuration serveur',
        method: 'INSERT INTO guild_config (guild_id, bot_role_name, ...) ou commande /setup',
        required: true
      },
      {
        step: '3',
        action: 'Définir les co-fondateurs',
        method: 'Ajouter discord_id dans guild_config.cofounders_ids (array)',
        required: true
      },
      {
        step: '4',
        action: 'Créer un thème',
        method: 'Commande /admin puis "Créer un thème" ou SQL direct',
        required: true
      },
      {
        step: '5',
        action: 'Créer des collectibles',
        method: 'Panel admin → Gérer Collectibles ou SQL direct',
        required: true
      },
      {
        step: '6',
        action: 'Créer des missions',
        method: 'Panel admin → Gérer Missions ou SQL direct',
        required: true
      },
      {
        step: '7',
        action: 'Configurer les rôles de progression',
        method: 'theme_config: role_ids, role_requirements',
        required: true
      },
      {
        step: '8',
        action: 'Activer le thème',
        method: 'Panel admin → "Activer ce thème"',
        required: true
      },
      {
        step: '9',
        action: 'Configurer announcement_settings',
        method: 'INSERT avec guild_id + toggles par défaut (true)',
        required: false
      },
      {
        step: '10',
        action: 'Créer templates d\'annonces personnalisés',
        method: 'Panel admin → Templates d\'annonces',
        required: false
      },
      {
        step: '11',
        action: 'Installer super bonuses pour ce serveur',
        method: 'Script: scripts/install-bonuses-existing-guilds.js',
        required: false
      },
      {
        step: '12',
        action: 'Tester Give système',
        method: 'Commande /give-unique → Mode "Tous" → Random 1 canal',
        required: true
      },
      {
        step: '13',
        action: 'Tester Mission système',
        method: 'Lancer une mission Quiz depuis le panel admin',
        required: true
      },
      {
        step: '14',
        action: 'Tester Mystery Box',
        method: 'Un joueur doit ouvrir une mystery box',
        required: true
      }
    ];

    console.log('\n📋 CHECKLIST COMPLÈTE:\n');
    checklist.forEach(item => {
      const icon = item.required ? '🔴' : '🟡';
      console.log(`${icon} Étape ${item.step}: ${item.action}`);
      console.log(`   → Méthode: ${item.method}`);
      console.log(`   → Requis: ${item.required ? 'OUI (CRITIQUE)' : 'Non (optionnel)'}\n`);
    });

    // ========================================
    // 4. VARIABLES D'ENVIRONNEMENT
    // ========================================
    console.log('\n\n🔐 SECTION 4: VARIABLES D\'ENVIRONNEMENT\n');
    console.log('='.repeat(100));

    const envVars = [
      { name: 'DISCORD_TOKEN', required: true, description: 'Token du bot Discord' },
      { name: 'CLIENT_ID', required: true, description: 'Application ID du bot' },
      { name: 'PGHOST', required: true, description: 'Hôte PostgreSQL' },
      { name: 'PGPORT', required: true, description: 'Port PostgreSQL (5432)' },
      { name: 'PGDATABASE', required: true, description: 'Nom de la base de données' },
      { name: 'PGUSER', required: true, description: 'Utilisateur PostgreSQL' },
      { name: 'PGPASSWORD', required: true, description: 'Mot de passe PostgreSQL' },
      { name: 'GUILD_ID', required: false, description: 'ID serveur par défaut (fallback)' }
    ];

    console.log('\n📋 Variables requises:\n');
    envVars.forEach(env => {
      const icon = env.required ? '🔴' : '🟡';
      const exists = process.env[env.name] ? '✅' : '❌';
      console.log(`${icon} ${env.name.padEnd(20)} ${exists} - ${env.description}`);

      if (env.required && !process.env[env.name]) {
        report.errors.push({
          section: 'Environment Variables',
          issue: `Missing ${env.name}`,
          impact: 'CRITICAL - Bot cannot start'
        });
      }
    });

    // ========================================
    // 5. FICHIERS CRITIQUES
    // ========================================
    console.log('\n\n📂 SECTION 5: FICHIERS CRITIQUES\n');
    console.log('='.repeat(100));

    const criticalFiles = [
      'index.js',
      'deploy-commands.js',
      'events/ready.js',
      'events/interactionCreate.js',
      'utils/database-pg.js',
      'handlers/giveUniqueHandler.js',
      'handlers/missionHandler.js',
      'handlers/mysteryBoxHandler.js',
      'handlers/adminPanelHandler.js',
      'handlers/profileHandler.js',
      'handlers/superBonusHandler.js',
      'handlers/badgeHandler.js',
      'views/profileView.js',
      'database/schema.sql'
    ];

    console.log('\n📋 Fichiers critiques:\n');
    let missingFiles = 0;
    for (const file of criticalFiles) {
      const filePath = path.join(__dirname, '..', file);
      const exists = fs.existsSync(filePath);
      const icon = exists ? '✅' : '❌';
      console.log(`${icon} ${file}`);

      if (!exists) {
        missingFiles++;
        report.errors.push({
          section: 'Critical Files',
          issue: `Missing file: ${file}`,
          impact: 'CRITICAL - Bot may not function'
        });
      }
    }

    if (missingFiles === 0) {
      console.log(`\n✅ Tous les fichiers critiques sont présents`);
      report.checks.push({
        section: 'Critical Files',
        status: 'OK',
        details: `${criticalFiles.length} fichiers présents`
      });
    }

    // ========================================
    // 6. COMMANDES DISCORD
    // ========================================
    console.log('\n\n⚙️ SECTION 6: COMMANDES DISCORD\n');
    console.log('='.repeat(100));

    const commandsDir = path.join(__dirname, '..', 'commands');
    let totalCommands = 0;

    const categories = ['admin', 'player', 'superadmin'];
    console.log('\n📋 Commandes par catégorie:\n');

    for (const category of categories) {
      const categoryPath = path.join(commandsDir, category);
      if (fs.existsSync(categoryPath)) {
        const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
        totalCommands += files.length;
        console.log(`✅ ${category.toUpperCase()}: ${files.length} commandes`);
        files.forEach(f => console.log(`   - ${f.replace('.js', '')}`));
      } else {
        console.log(`❌ ${category.toUpperCase()}: Dossier manquant`);
        report.warnings.push({
          section: 'Commands',
          issue: `Missing ${category} commands directory`
        });
      }
    }

    console.log(`\n📊 Total: ${totalCommands} commandes`);
    report.checks.push({
      section: 'Commands',
      status: 'OK',
      details: `${totalCommands} commandes disponibles`
    });

    // ========================================
    // 7. GÉNÉRATION RAPPORT FINAL
    // ========================================
    console.log('\n\n' + '='.repeat(100));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(100) + '\n');

    report.summary = {
      total_checks: report.checks.length,
      total_warnings: report.warnings.length,
      total_errors: report.errors.length,
      readiness_score: calculateReadinessScore(report)
    };

    console.log(`✅ Vérifications réussies: ${report.checks.length}`);
    console.log(`⚠️  Avertissements: ${report.warnings.length}`);
    console.log(`❌ Erreurs critiques: ${report.errors.length}`);
    console.log(`\n🎯 Score de préparation: ${report.summary.readiness_score}%\n`);

    if (report.errors.length > 0) {
      console.log('❌ ERREURS CRITIQUES À CORRIGER:\n');
      report.errors.forEach((err, i) => {
        console.log(`${i + 1}. [${err.section}] ${err.issue}`);
        if (err.impact) console.log(`   Impact: ${err.impact}`);
        if (err.details) console.log(`   Détails: ${JSON.stringify(err.details)}`);
      });
    }

    if (report.warnings.length > 0) {
      console.log('\n⚠️  AVERTISSEMENTS:\n');
      report.warnings.forEach((warn, i) => {
        console.log(`${i + 1}. [${warn.section}] ${warn.issue}`);
        if (warn.impact) console.log(`   Impact: ${warn.impact}`);
        if (warn.details) console.log(`   Détails: ${JSON.stringify(warn.details)}`);
      });
    }

    // Recommandation finale
    console.log('\n' + '='.repeat(100));
    if (report.summary.readiness_score >= 90) {
      console.log('✅ VERDICT: Le bot est PRÊT pour le déploiement sur un nouveau serveur');
      console.log('   → Suivre la checklist en Section 3 pour configurer le nouveau serveur');
    } else if (report.summary.readiness_score >= 70) {
      console.log('⚠️  VERDICT: Le bot est PARTIELLEMENT PRÊT');
      console.log('   → Corriger les erreurs critiques avant le déploiement');
      console.log('   → Les avertissements peuvent être résolus après le déploiement');
    } else {
      console.log('❌ VERDICT: Le bot N\'EST PAS PRÊT pour le déploiement');
      console.log('   → Corriger TOUTES les erreurs critiques avant de continuer');
    }
    console.log('='.repeat(100) + '\n');

    // Sauvegarder le rapport JSON
    const reportPath = path.join(__dirname, '..', 'NEW-SERVER-READINESS-REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Rapport complet sauvegardé: NEW-SERVER-READINESS-REPORT.json\n`);

    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur lors de l\'analyse:', error);
    process.exit(1);
  }
}

function calculateReadinessScore(report) {
  const totalChecks = report.checks.length + report.warnings.length + report.errors.length;
  if (totalChecks === 0) return 0;

  const checksWeight = report.checks.length * 100;
  const warningsWeight = report.warnings.length * 70;
  const errorsWeight = report.errors.length * 0;

  const totalWeight = checksWeight + warningsWeight + errorsWeight;
  return Math.round((totalWeight / (totalChecks * 100)) * 100);
}

analyzeNewServerReadiness();
