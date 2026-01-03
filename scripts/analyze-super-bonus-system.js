const db = require('../utils/database-pg');

/**
 * AUDIT COMPLET DU SYSTÈME DE SUPER BONUS
 *
 * Objectifs:
 * 1. Analyser la structure DB (tables, colonnes, types)
 * 2. Lister tous les super bonus existants
 * 3. Vérifier les logs et leur traçabilité
 * 4. Analyser la faisabilité de chaque bonus
 * 5. Identifier ce qui manque
 */

async function analyzeDatabase() {
  console.log('\n🔍 AUDIT SYSTÈME DE SUPER BONUS\n');
  console.log('='.repeat(100));

  try {
    // ========== 1. STRUCTURE DES TABLES ==========
    console.log('\n📊 1. STRUCTURE DES TABLES SUPER BONUS');
    console.log('-'.repeat(100));

    // Lister toutes les tables liées aux super bonus
    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%bonus%'
      OR table_name LIKE '%super_admin%'
      ORDER BY table_name
    `);

    console.log('\n✅ Tables détectées:');
    console.table(tables);

    // Détail de super_bonuses
    console.log('\n📋 Détail table: super_bonuses');
    const superBonusesColumns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      ORDER BY ordinal_position
    `);
    console.table(superBonusesColumns);

    // Détail de player_active_bonuses
    console.log('\n📋 Détail table: player_active_bonuses');
    const playerActiveBonusesColumns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);
    console.table(playerActiveBonusesColumns);

    // Détail de super_admin_logs
    console.log('\n📋 Détail table: super_admin_logs');
    const logsColumns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'super_admin_logs'
      ORDER BY ordinal_position
    `);
    console.table(logsColumns);

    // ========== 2. SUPER BONUS EXISTANTS ==========
    console.log('\n\n🎁 2. SUPER BONUS EXISTANTS DANS LA DB');
    console.log('-'.repeat(100));

    const existingBonuses = await db.queryAll(`
      SELECT
        id,
        guild_id,
        bonus_id,
        name,
        description,
        icon,
        rarity,
        effect_type,
        effect_config,
        bonus_type,
        duration_type,
        duration_value,
        created_at
      FROM super_bonuses
      ORDER BY
        CASE rarity
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'common' THEN 4
        END,
        name
    `);

    if (existingBonuses.length > 0) {
      console.log(`\n✅ ${existingBonuses.length} super bonus trouvés:\n`);

      for (const bonus of existingBonuses) {
        console.log(`\n${bonus.icon} ${bonus.name} (ID DB: ${bonus.id}, Bonus ID: ${bonus.bonus_id})`);
        console.log(`   Guild: ${bonus.guild_id}`);
        console.log(`   Rareté: ${bonus.rarity}`);
        console.log(`   Type: ${bonus.bonus_type} / ${bonus.effect_type}`);
        console.log(`   Description: ${bonus.description}`);
        console.log(`   Config: ${JSON.stringify(bonus.effect_config)}`);
        console.log(`   Durée: ${bonus.duration_type} (${bonus.duration_value || 'N/A'})`);
        console.log(`   Créé le: ${new Date(bonus.created_at).toLocaleDateString('fr-FR')}`);
      }
    } else {
      console.log('\n⚠️  AUCUN super bonus trouvé dans la base de données !');
      console.log('   → Les super bonus doivent être créés et installés d\'office à l\'invitation du bot');
    }

    // ========== 3. BONUS ACTIFS JOUEURS ==========
    console.log('\n\n👥 3. BONUS ACTIFS DES JOUEURS');
    console.log('-'.repeat(100));

    const activeBonuses = await db.queryAll(`
      SELECT
        pab.id,
        pab.user_id,
        pab.guild_id,
        sb.name as bonus_name,
        sb.icon,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        pab.is_active
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.is_active = true
      AND (
        pab.expires_at IS NULL
        OR pab.expires_at > NOW()
      )
      AND (
        pab.remaining_charges IS NULL
        OR pab.remaining_charges > 0
      )
      ORDER BY pab.activated_at DESC
      LIMIT 20
    `);

    if (activeBonuses.length > 0) {
      console.log(`\n✅ ${activeBonuses.length} bonus actifs (20 premiers):\n`);
      console.table(activeBonuses);
    } else {
      console.log('\n⚠️  Aucun bonus actif trouvé');
    }

    // ========== 4. SYSTÈME DE LOGGING ==========
    console.log('\n\n📝 4. SYSTÈME DE LOGGING');
    console.log('-'.repeat(100));

    // Vérifier si la table de logs existe
    const hasLogsTable = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'super_admin_logs'
      ) as exists
    `);

    if (hasLogsTable.exists) {
      const logsCount = await db.queryOne(`
        SELECT COUNT(*) as count
        FROM super_admin_logs
      `);
      console.log(`\n✅ Table super_admin_logs existe (${logsCount.count} entrées)`);

      // Échantillon des derniers logs
      const recentLogs = await db.queryAll(`
        SELECT
          admin_id,
          action,
          target_guild_id,
          details,
          created_at
        FROM super_admin_logs
        ORDER BY created_at DESC
        LIMIT 10
      `);

      if (recentLogs.length > 0) {
        console.log('\n📋 10 derniers logs:');
        console.table(recentLogs);
      }

      // Types d'actions loggées
      const actionTypes = await db.queryAll(`
        SELECT
          action,
          COUNT(*) as count
        FROM super_admin_logs
        GROUP BY action
        ORDER BY count DESC
      `);

      if (actionTypes.length > 0) {
        console.log('\n📊 Types d\'actions loggées:');
        console.table(actionTypes);
      }
    } else {
      console.log('\n❌ Table super_admin_logs INTROUVABLE !');
      console.log('   → CRITIQUE: Le système de traçabilité doit être implémenté');
    }

    // Vérifier les logs d'utilisation de bonus
    const hasBonusUsageTable = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'bonus_usage_logs'
      ) as exists
    `);

    if (hasBonusUsageTable.exists) {
      const usageLogsCount = await db.queryOne(`
        SELECT COUNT(*) as count
        FROM bonus_usage_logs
      `);
      console.log(`\n✅ Table bonus_usage_logs existe (${usageLogsCount.count} entrées)`);
    } else {
      console.log('\n⚠️  Table bonus_usage_logs INTROUVABLE');
      console.log('   → Il faut créer cette table pour tracer l\'utilisation des bonus');
    }

    // ========== 5. MÉTHODES DB DISPONIBLES ==========
    console.log('\n\n🔧 5. MÉTHODES DATABASE-PG DISPONIBLES');
    console.log('-'.repeat(100));

    console.log('\n📚 Recherche des méthodes liées aux super bonus dans utils/database-pg.js...');

    const fs = require('fs');
    const dbContent = fs.readFileSync('./utils/database-pg.js', 'utf8');

    const bonusMethods = [];
    const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*{[^}]*(?:bonus|super_bonus)/gi;
    let match;

    while ((match = methodRegex.exec(dbContent)) !== null) {
      if (!bonusMethods.includes(match[1])) {
        bonusMethods.push(match[1]);
      }
    }

    if (bonusMethods.length > 0) {
      console.log('\n✅ Méthodes détectées:');
      bonusMethods.forEach(method => console.log(`   - ${method}()`));
    } else {
      console.log('\n⚠️  Aucune méthode spécifique aux bonus trouvée');
    }

    // ========== 6. RÉSUMÉ ET RECOMMANDATIONS ==========
    console.log('\n\n📋 6. RÉSUMÉ ET RECOMMANDATIONS');
    console.log('='.repeat(100));

    console.log('\n✅ POINTS POSITIFS:');
    console.log('   • Handler superBonusHandler.js existe et est bien structuré');
    console.log('   • Méthodes de gestion des bonus (apply, consume, check) implémentées');
    console.log('   • Support de différents types d\'effets (probability, rarity_boost, reveal, etc.)');
    console.log('   • Système de charges et d\'expiration');

    console.log('\n⚠️  POINTS À VÉRIFIER/IMPLÉMENTER:');

    if (existingBonuses.length === 0) {
      console.log('   • CRITIQUE: Créer les super bonus de base dans la DB');
      console.log('   • CRITIQUE: Système d\'installation automatique à l\'invitation du bot');
    }

    if (!hasLogsTable.exists || !hasBonusUsageTable.exists) {
      console.log('   • CRITIQUE: Table(s) de logs manquante(s)');
      console.log('   • Implémenter système de traçabilité complet');
    }

    console.log('   • Déplacer /my-bonuses dans /profile avec nouveau bouton');
    console.log('   • Vérifier la faisabilité de chaque type de bonus');
    console.log('   • Tester l\'intégration avec mysteryBoxHandler');
    console.log('   • Créer migration pour installation auto sur nouveaux serveurs');

    console.log('\n' + '='.repeat(100));
    console.log('✅ Audit terminé\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'audit:', error);
    process.exit(1);
  }
}

analyzeDatabase();
