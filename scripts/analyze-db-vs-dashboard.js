/**
 * Analyse complète: Base de données vs Dashboard Theme Builder
 * Compare les structures DB réelles avec ce que les composants attendent
 */

const db = require('../utils/database-pg');

async function analyzeDatabase() {
  console.log('═'.repeat(80));
  console.log('🔍 ANALYSE COMPLÈTE: BASE DE DONNÉES vs DASHBOARD THEME BUILDER');
  console.log('═'.repeat(80));
  console.log();

  try {
    // ═══════════════════════════════════════════════════════════════
    // 1. TABLES PRINCIPALES DU THÈME
    // ═══════════════════════════════════════════════════════════════
    console.log('📊 1. STRUCTURE DES TABLES THÉMATIQUES');
    console.log('─'.repeat(80));

    const tables = ['themes', 'collectibles', 'traps', 'missions', 'theme_config', 'theme_messages', 'quiz_questions', 'mission_keywords'];

    const dbStructure = {};

    for (const table of tables) {
      const columns = await db.queryAll(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      dbStructure[table] = columns;

      console.log(`\n📋 Table: ${table.toUpperCase()} (${columns.length} colonnes)`);
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '?' : '!';
        const defaultVal = col.column_default ? ` = ${col.column_default.substring(0, 30)}` : '';
        console.log(`   ${nullable} ${col.column_name}: ${col.data_type}${defaultVal}`);
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. VÉRIFIER CE QUE importThemeToBot ATTEND
    // ═══════════════════════════════════════════════════════════════
    console.log('\n\n📊 2. MAPPING: importThemeToBot vs DB');
    console.log('─'.repeat(80));

    // Mapping des colonnes utilisées par importThemeToBot
    const importThemeToBotMapping = {
      themes: {
        usedColumns: ['guild_id', 'theme_id', 'name', 'duration_days', 'required_items', 'final_role_name', 'final_role_color'],
        sourceFields: ['guildId', 'themeId', 'themeData.theme.name', 'themeData.theme.duration_days', 'themeData.theme.required_items', 'themeData.theme.final_role_name/final_role.name', 'themeData.theme.final_role_color/final_role.color']
      },
      collectibles: {
        usedColumns: ['guild_id', 'theme_id', 'collectible_id', 'name', 'image_url', 'rarity', 'reveal_message'],
        sourceFields: ['guildId', 'numericThemeId', 'col.collectible_id', 'col.name', 'col.image_url', 'col.rarity', 'col.reveal_message']
      },
      traps: {
        usedColumns: ['guild_id', 'theme_id', 'trap_id', 'name', 'type', 'description', 'image_url', 'cooldown_duration', 'removes_collectible', 'malus_points', 'is_active'],
        sourceFields: ['guildId', 'numericThemeId', 'trap.trap_id', 'trap.name', 'trap.type', 'trap.description', 'trap.image_url', 'trap.duration_hours*60', 'trapType includes lose', 'trap.malus_points', 'trap.is_enabled']
      },
      missions: {
        usedColumns: ['guild_id', 'theme_id', 'mission_id', 'name', 'type', 'description', 'validation_type', 'reward_type', 'timeout'],
        sourceFields: ['guildId', 'numericThemeId', 'mission.mission_id', 'mission.name', 'quiz|keyword-message', 'mission.description', 'auto|manual', 'mission.reward_type', 'mission.time_limit']
      },
      theme_config: {
        usedColumns: ['guild_id', 'theme_id', 'probability_collectible', 'probability_mission', 'probability_trap', 'probability_super_bonus'],
        sourceFields: ['guildId', 'numericThemeId', 'theme_config.probability_*']
      }
    };

    // Vérifier chaque table
    for (const [table, mapping] of Object.entries(importThemeToBotMapping)) {
      console.log(`\n🔍 ${table.toUpperCase()}`);

      const dbCols = dbStructure[table]?.map(c => c.column_name) || [];
      const missingInDb = mapping.usedColumns.filter(c => !dbCols.includes(c));
      const extraInDb = dbCols.filter(c => !mapping.usedColumns.includes(c) && c !== 'id' && c !== 'created_at' && c !== 'updated_at');

      if (missingInDb.length === 0) {
        console.log(`   ✅ Toutes les colonnes requises existent`);
      } else {
        console.log(`   ❌ COLONNES MANQUANTES DANS DB: ${missingInDb.join(', ')}`);
      }

      if (extraInDb.length > 0) {
        console.log(`   ℹ️  Colonnes DB non utilisées par import: ${extraInDb.join(', ')}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. VÉRIFIER CE QUE LE FRONTEND CHARGE (loadThemeFromGuild)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n\n📊 3. MAPPING: loadThemeFromGuild (Frontend) vs DB');
    console.log('─'.repeat(80));

    // Ce que le frontend attend quand il charge un thème du serveur
    const frontendExpects = {
      themes: ['id', 'theme_id', 'name', 'duration_days', 'required_items', 'final_role_name', 'final_role_color', 'is_active'],
      collectibles: ['id', 'collectible_id', 'name', 'rarity', 'image_url', 'emoji', 'reveal_message'],
      traps: ['id', 'trap_id', 'name', 'type', 'description', 'image_url', 'effect_value', 'duration_hours', 'is_enabled', 'emoji'],
      missions: ['id', 'mission_id', 'name', 'type', 'description', 'time_limit_seconds', 'reward_type'],
      theme_config: ['probability_collectible', 'probability_mission', 'probability_trap', 'probability_super_bonus', 'rarity_legendary', 'rarity_epic', 'rarity_rare', 'rarity_common', 'mystery_box_image']
    };

    for (const [table, expectedCols] of Object.entries(frontendExpects)) {
      console.log(`\n🔍 ${table.toUpperCase()} (Frontend attend)`);

      const dbCols = dbStructure[table]?.map(c => c.column_name) || [];
      const missingInDb = expectedCols.filter(c => !dbCols.includes(c));

      if (missingInDb.length === 0) {
        console.log(`   ✅ Toutes les colonnes attendues existent`);
      } else {
        console.log(`   ⚠️  COLONNES ATTENDUES ABSENTES: ${missingInDb.join(', ')}`);
        console.log(`   📝 Le frontend doit mapper ces champs différemment`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. DONNÉES EXEMPLE POUR VÉRIFIER LE FORMAT
    // ═══════════════════════════════════════════════════════════════
    console.log('\n\n📊 4. DONNÉES EXEMPLE (Thème Monopoly)');
    console.log('─'.repeat(80));

    // Trouver un thème exemple
    const exampleTheme = await db.queryOne(`
      SELECT * FROM themes WHERE name ILIKE '%monopoly%' LIMIT 1
    `);

    if (exampleTheme) {
      console.log('\n📋 THEME:');
      console.log(JSON.stringify(exampleTheme, null, 2));

      // Collectibles
      const collectibles = await db.queryAll(`
        SELECT * FROM collectibles WHERE theme_id = $1 LIMIT 3
      `, [exampleTheme.id]);
      console.log('\n📋 COLLECTIBLES (3 premiers):');
      console.log(JSON.stringify(collectibles, null, 2));

      // Traps
      const traps = await db.queryAll(`
        SELECT * FROM traps WHERE theme_id = $1 LIMIT 2
      `, [exampleTheme.id]);
      console.log('\n📋 TRAPS (2 premiers):');
      console.log(JSON.stringify(traps, null, 2));

      // Missions
      const missions = await db.queryAll(`
        SELECT * FROM missions WHERE theme_id = $1 LIMIT 2
      `, [exampleTheme.id]);
      console.log('\n📋 MISSIONS (2 premières):');
      console.log(JSON.stringify(missions, null, 2));

      // Theme config
      const themeConfig = await db.queryOne(`
        SELECT * FROM theme_config WHERE theme_id = $1
      `, [exampleTheme.id]);
      console.log('\n📋 THEME_CONFIG:');
      console.log(JSON.stringify(themeConfig, null, 2));
    } else {
      console.log('   ⚠️ Aucun thème exemple trouvé');
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. RÉSUMÉ DES PROBLÈMES DÉTECTÉS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n\n📊 5. RÉSUMÉ DES INCOHÉRENCES DÉTECTÉES');
    console.log('─'.repeat(80));

    const issues = [];

    // Vérifier traps
    const trapsCols = dbStructure.traps?.map(c => c.column_name) || [];
    if (!trapsCols.includes('effect_value')) {
      issues.push({
        table: 'traps',
        issue: 'Frontend attend "effect_value" mais DB a "malus_points"',
        fix: 'Mapper effect_value -> malus_points dans loadThemeFromGuild'
      });
    }
    if (!trapsCols.includes('duration_hours')) {
      issues.push({
        table: 'traps',
        issue: 'Frontend attend "duration_hours" mais DB a "cooldown_duration" (en minutes)',
        fix: 'Mapper cooldown_duration / 60 -> duration_hours'
      });
    }
    if (!trapsCols.includes('is_enabled')) {
      issues.push({
        table: 'traps',
        issue: 'Frontend attend "is_enabled" mais DB a "is_active"',
        fix: 'Mapper is_active -> is_enabled'
      });
    }

    // Vérifier theme_config
    const configCols = dbStructure.theme_config?.map(c => c.column_name) || [];
    if (!configCols.includes('rarity_legendary')) {
      issues.push({
        table: 'theme_config',
        issue: 'Frontend attend "rarity_legendary" etc.',
        fix: 'Vérifier noms exacts des colonnes de rareté dans DB'
      });
    }

    if (issues.length === 0) {
      console.log('✅ Aucune incohérence majeure détectée');
    } else {
      issues.forEach((issue, i) => {
        console.log(`\n❌ Issue ${i + 1}: ${issue.table}`);
        console.log(`   Problème: ${issue.issue}`);
        console.log(`   Solution: ${issue.fix}`);
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ ANALYSE TERMINÉE');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    process.exit(0);
  }
}

analyzeDatabase();
