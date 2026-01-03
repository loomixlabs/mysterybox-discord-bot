/**
 * Script de génération du schéma de base de données en Markdown
 * Génère une documentation exhaustive de toutes les tables
 */

const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

async function generateSchemaMarkdown() {
  console.log('🔍 Génération du schéma de base de données...\n');

  // Récupérer toutes les tables
  const tables = await db.queryAll(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  let md = `# 📊 SCHÉMA COMPLET DE LA BASE DE DONNÉES
## Bot Discord Loomix - Documentation Technique

> **Généré le**: ${new Date().toISOString().split('T')[0]}
> **Base de données**: PostgreSQL
> **Nombre de tables**: ${tables.length}

---

## 📑 TABLE DES MATIÈRES

`;

  // Catégoriser les tables
  const categories = {
    'Configuration Serveur': ['guild_config', 'guild_branding', 'guild_admin_roles', 'guild_stats', 'announcement_channel', 'announcement_settings'],
    'Thèmes & Gameplay': ['themes', 'theme_config', 'theme_messages', 'collectibles', 'traps', 'colors'],
    'Missions': ['missions', 'mission_progress', 'mission_keywords', 'quiz_questions'],
    'Joueurs': ['players', 'player_progress', 'collections', 'player_cooldowns', 'player_malus_points', 'player_login_history'],
    'Badges': ['badges', 'badge_progress', 'player_badges'],
    'Super Bonus': ['super_bonuses', 'player_active_bonuses', 'bonus_usage_history'],
    'Campagnes & Gives': ['give_campaigns', 'give_channels', 'give_logs'],
    'Annonces': ['announcement_templates'],
    'Pièges': ['trap_triggered'],
    'Super Admin': ['super_admins', 'super_admin_logs', 'audit_logs'],
    'Theme Builder (Dashboard)': ['themes_library', 'theme_uploads', 'theme_builder_sessions', 'theme_builder_logs', 'theme_builder_config', 'theme_builder_user_quotas', 'theme_creator_guilds', 'banned_builder_users'],
    'Autres': ['apple_game_winners']
  };

  // Générer la table des matières
  for (const [category, tableNames] of Object.entries(categories)) {
    md += `### ${category}\n`;
    for (const tableName of tableNames) {
      const tableExists = tables.find(t => t.table_name === tableName);
      if (tableExists) {
        md += `- [${tableName}](#${tableName})\n`;
      }
    }
    md += '\n';
  }

  md += `---\n\n`;

  // Générer le détail de chaque table
  for (const [category, tableNames] of Object.entries(categories)) {
    md += `## 📁 ${category.toUpperCase()}\n\n`;

    for (const tableName of tableNames) {
      const tableExists = tables.find(t => t.table_name === tableName);
      if (!tableExists) continue;

      console.log(`  📋 ${tableName}...`);

      // Récupérer les colonnes
      const columns = await db.queryAll(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          column_default,
          is_nullable,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      // Récupérer les contraintes (PK, FK, UNIQUE)
      const constraints = await db.queryAll(`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.constraint_type = 'FOREIGN KEY'
        WHERE tc.table_schema = 'public' AND tc.table_name = $1
      `, [tableName]);

      // Récupérer les index
      const indexes = await db.queryAll(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = $1
      `, [tableName]);

      // Récupérer les CHECK constraints
      const checks = await db.queryAll(`
        SELECT
          conname as constraint_name,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass AND contype = 'c'
      `, [tableName]);

      // Compter les lignes
      let rowCount = 0;
      try {
        const countResult = await db.queryOne(`SELECT COUNT(*) as count FROM ${tableName}`);
        rowCount = countResult?.count || 0;
      } catch (e) {
        rowCount = '?';
      }

      md += `### ${tableName}\n\n`;
      md += `> **Lignes**: ${rowCount} | **Colonnes**: ${columns.length}\n\n`;

      // Table des colonnes
      md += `| Colonne | Type | Nullable | Défaut | Description |\n`;
      md += `|---------|------|----------|--------|-------------|\n`;

      for (const col of columns) {
        let type = col.data_type;
        if (col.character_maximum_length) {
          type += `(${col.character_maximum_length})`;
        }
        if (col.udt_name === 'int4') type = 'integer';
        if (col.udt_name === 'int8') type = 'bigint';
        if (col.udt_name === 'bool') type = 'boolean';
        if (col.udt_name === 'timestamptz') type = 'timestamp with time zone';

        const nullable = col.is_nullable === 'YES' ? '✓' : '✗';
        let defaultVal = col.column_default || '-';
        if (defaultVal.length > 30) defaultVal = defaultVal.substring(0, 30) + '...';

        // Identifier PK et FK
        const pk = constraints.find(c => c.constraint_type === 'PRIMARY KEY' && c.column_name === col.column_name);
        const fk = constraints.find(c => c.constraint_type === 'FOREIGN KEY' && c.column_name === col.column_name);

        let desc = '';
        if (pk) desc += '🔑 PK ';
        if (fk) desc += `🔗 FK → ${fk.foreign_table}.${fk.foreign_column}`;

        md += `| ${col.column_name} | ${type} | ${nullable} | ${defaultVal} | ${desc} |\n`;
      }

      // Contraintes CHECK
      if (checks.length > 0) {
        md += `\n**Contraintes CHECK:**\n`;
        for (const check of checks) {
          md += `- \`${check.constraint_name}\`: ${check.definition}\n`;
        }
      }

      // Index
      const nonPkIndexes = indexes.filter(idx => !idx.indexname.includes('_pkey'));
      if (nonPkIndexes.length > 0) {
        md += `\n**Index:**\n`;
        for (const idx of nonPkIndexes) {
          md += `- \`${idx.indexname}\`\n`;
        }
      }

      md += `\n---\n\n`;
    }
  }

  // Relations
  md += `## 🔗 RELATIONS ENTRE TABLES\n\n`;
  md += `\`\`\`\n`;
  md += `guild_config (1) ──────< (N) themes\n`;
  md += `themes (1) ────────────< (N) collectibles\n`;
  md += `themes (1) ────────────< (N) traps\n`;
  md += `themes (1) ────────────< (N) missions\n`;
  md += `themes (1) ────────────< (N) theme_config\n`;
  md += `themes (1) ────────────< (N) theme_messages\n`;
  md += `missions (1) ──────────< (N) quiz_questions\n`;
  md += `missions (1) ──────────< (N) mission_keywords\n`;
  md += `missions (1) ──────────< (N) mission_progress\n`;
  md += `players (1) ───────────< (N) collections\n`;
  md += `players (1) ───────────< (N) player_progress\n`;
  md += `players (1) ───────────< (N) player_active_bonuses\n`;
  md += `players (1) ───────────< (N) player_cooldowns\n`;
  md += `collectibles (1) ──────< (N) collections\n`;
  md += `super_bonuses (1) ─────< (N) player_active_bonuses\n`;
  md += `badges (1) ────────────< (N) player_badges\n`;
  md += `badges (1) ────────────< (N) badge_progress\n`;
  md += `\`\`\`\n\n`;

  // Notes importantes
  md += `## ⚠️ RÈGLES CRITIQUES\n\n`;
  md += `### Isolation Multi-Serveur\n`;
  md += `**TOUTES les requêtes SQL doivent inclure \`guild_id\`** pour assurer l'isolation des données entre serveurs.\n\n`;
  md += `\`\`\`sql\n`;
  md += `-- ✅ CORRECT\n`;
  md += `SELECT * FROM collectibles WHERE guild_id = $1 AND theme_id = $2;\n\n`;
  md += `-- ❌ INCORRECT (fuite de données entre serveurs)\n`;
  md += `SELECT * FROM collectibles WHERE theme_id = $2;\n`;
  md += `\`\`\`\n\n`;

  md += `### Colonnes Communes\n`;
  md += `La plupart des tables incluent:\n`;
  md += `- \`guild_id\`: VARCHAR(32) - ID du serveur Discord\n`;
  md += `- \`created_at\`: TIMESTAMP - Date de création\n`;
  md += `- \`updated_at\`: TIMESTAMP - Dernière modification\n\n`;

  md += `---\n\n`;
  md += `*Document généré automatiquement par generate-database-schema-md.js*\n`;

  // Écrire le fichier
  const outputPath = path.join(__dirname, '..', 'DATABASE-SCHEMA-COMPLETE.md');
  fs.writeFileSync(outputPath, md, 'utf8');

  console.log(`\n✅ Schéma généré: ${outputPath}`);
  console.log(`📊 ${tables.length} tables documentées`);

  process.exit(0);
}

generateSchemaMarkdown().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
