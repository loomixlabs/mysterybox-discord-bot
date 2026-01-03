require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * AUDIT EXPERT: Analyse complète de la base de données PostgreSQL
 * Génère un DATABASE-SCHEMA.md précis et optimisé pour Claude Code
 */

async function auditDatabase() {
  console.log('\n🔍 AUDIT EXPERT: Base de Données PostgreSQL\n');
  console.log('═'.repeat(100));

  try {
    // ========================================
    // PHASE 1: Liste des tables
    // ========================================
    console.log('\n📋 PHASE 1: Récupération de toutes les tables\n');

    const tables = await pool.query(`
      SELECT
        table_name,
        (SELECT obj_description(c.oid) FROM pg_class c WHERE c.relname = table_name) as comment
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`✅ ${tables.rows.length} tables trouvées\n`);

    // ========================================
    // PHASE 2: Analyse détaillée par table
    // ========================================
    console.log('📋 PHASE 2: Analyse détaillée de chaque table\n');

    const tableDetails = {};

    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`   Analyse de ${tableName}...`);

      // Colonnes
      const columns = await pool.query(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      // Primary Key
      const pk = await pool.query(`
        SELECT
          conname,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'p'
      `, [tableName]);

      // Contraintes UNIQUE
      const unique = await pool.query(`
        SELECT
          conname,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'u'
      `, [tableName]);

      // Contraintes CHECK
      const check = await pool.query(`
        SELECT
          conname,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'c'
      `, [tableName]);

      // Foreign Keys (sortantes)
      const fk = await pool.query(`
        SELECT
          conname,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'f'
      `, [tableName]);

      // Foreign Keys (entrantes - tables qui référencent cette table)
      const fkInbound = await pool.query(`
        SELECT
          conrelid::regclass::text as referencing_table,
          conname,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE confrelid = $1::regclass
          AND contype = 'f'
      `, [tableName]);

      // Index
      const indexes = await pool.query(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = $1
          AND schemaname = 'public'
        ORDER BY indexname
      `, [tableName]);

      // Triggers
      const triggers = await pool.query(`
        SELECT
          trigger_name,
          event_manipulation,
          action_statement
        FROM information_schema.triggers
        WHERE event_object_table = $1
        ORDER BY trigger_name
      `, [tableName]);

      tableDetails[tableName] = {
        comment: table.comment,
        columns: columns.rows,
        primaryKey: pk.rows,
        unique: unique.rows,
        check: check.rows,
        foreignKeys: fk.rows,
        referencedBy: fkInbound.rows,
        indexes: indexes.rows,
        triggers: triggers.rows
      };
    }

    console.log('\n✅ Analyse complète terminée\n');

    // ========================================
    // PHASE 3: Catégorisation intelligente
    // ========================================
    console.log('📋 PHASE 3: Catégorisation des tables\n');

    const categories = {
      configuration: [],
      players: [],
      badges: [],
      themes: [],
      missions: [],
      campaigns: [],
      super_admin: [],
      super_bonus: [],
      tracking: [],
      other: []
    };

    for (const tableName of Object.keys(tableDetails)) {
      if (tableName.startsWith('badge') || tableName.includes('badge')) {
        categories.badges.push(tableName);
      } else if (tableName.includes('player') && !tableName.includes('badge')) {
        categories.players.push(tableName);
      } else if (tableName.includes('theme') || tableName === 'collectibles' || tableName === 'traps') {
        categories.themes.push(tableName);
      } else if (tableName.includes('mission') || tableName.includes('quiz')) {
        categories.missions.push(tableName);
      } else if (tableName.includes('campaign') || tableName === 'give_channels' || tableName === 'give_logs') {
        categories.campaigns.push(tableName);
      } else if (tableName.startsWith('super_admin')) {
        categories.super_admin.push(tableName);
      } else if (tableName.startsWith('super_bonus') || tableName === 'bonus_usage_history') {
        categories.super_bonus.push(tableName);
      } else if (tableName.includes('_log') || tableName.includes('history') || tableName === 'trap_triggered') {
        categories.tracking.push(tableName);
      } else if (tableName === 'guild_config' || tableName === 'announcement_settings' || tableName === 'announcement_templates') {
        categories.configuration.push(tableName);
      } else {
        categories.other.push(tableName);
      }
    }

    console.log('✅ Catégorisation terminée:\n');
    for (const [category, tableList] of Object.entries(categories)) {
      if (tableList.length > 0) {
        console.log(`   ${category}: ${tableList.length} table(s)`);
      }
    }

    // ========================================
    // PHASE 4: Détection d'anomalies
    // ========================================
    console.log('\n\n📋 PHASE 4: Détection d\'anomalies\n');

    const anomalies = [];

    for (const [tableName, details] of Object.entries(tableDetails)) {
      // Vérifier si guild_id existe (multi-serveur)
      const hasGuildId = details.columns.some(col => col.column_name === 'guild_id');

      // Tables qui DEVRAIENT avoir guild_id
      const shouldHaveGuildId = ![
        'super_admins', 'super_bonuses', 'super_admin_logs',
        'guild_config', 'badges' // badges est master, pas par serveur
      ].includes(tableName);

      if (shouldHaveGuildId && !hasGuildId) {
        anomalies.push({
          table: tableName,
          type: 'missing_guild_id',
          message: 'Colonne guild_id manquante (table multi-serveur)'
        });
      }

      // Vérifier les foreign keys sans ON DELETE
      for (const fk of details.foreignKeys) {
        if (!fk.definition.includes('ON DELETE')) {
          anomalies.push({
            table: tableName,
            type: 'missing_on_delete',
            message: `FK ${fk.conname} sans clause ON DELETE`,
            detail: fk.definition
          });
        }
      }

      // Vérifier les colonnes timestamps standards
      const hasCreatedAt = details.columns.some(col => col.column_name === 'created_at');
      const hasUpdatedAt = details.columns.some(col => col.column_name === 'updated_at');

      if (hasUpdatedAt && !details.triggers.some(t => t.trigger_name.includes('update'))) {
        anomalies.push({
          table: tableName,
          type: 'missing_update_trigger',
          message: 'Colonne updated_at sans trigger auto-update'
        });
      }
    }

    if (anomalies.length > 0) {
      console.log(`⚠️  ${anomalies.length} anomalie(s) détectée(s):\n`);
      anomalies.forEach((anomaly, i) => {
        console.log(`   ${i + 1}. [${anomaly.table}] ${anomaly.type}: ${anomaly.message}`);
        if (anomaly.detail) {
          console.log(`      → ${anomaly.detail}`);
        }
      });
    } else {
      console.log('✅ Aucune anomalie détectée');
    }

    // ========================================
    // PHASE 5: Génération du Markdown
    // ========================================
    console.log('\n\n📋 PHASE 5: Génération du DATABASE-SCHEMA.md\n');

    let markdown = generateMarkdown(tableDetails, categories, anomalies, tables.rows.length);

    // Écrire le fichier
    const outputPath = path.join(__dirname, '../DATABASE-SCHEMA.md');
    fs.writeFileSync(outputPath, markdown, 'utf8');

    console.log(`✅ Fichier généré: ${outputPath}`);
    console.log(`   Taille: ${markdown.length} caractères`);
    console.log(`   Lignes: ${markdown.split('\n').length}`);

    console.log('\n' + '═'.repeat(100));
    console.log('\n🎉 AUDIT TERMINÉ AVEC SUCCÈS\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'audit:', error.message);
    console.error('\n📋 Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Génère le contenu Markdown du schema
 */
function generateMarkdown(tableDetails, categories, anomalies, totalTables) {
  const now = new Date().toISOString().split('T')[0];

  let md = `# DATABASE SCHEMA - Bot Discord Multi-Serveur

> **Dernière mise à jour**: ${now}
> **Total tables**: ${totalTables}
> **PostgreSQL**: Compatible 14+

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Multi-Serveur](#architecture-multi-serveur)
3. [Tables par Catégorie](#tables-par-catégorie)
4. [Schéma Détaillé](#schéma-détaillé)
5. [Anomalies Détectées](#anomalies-détectées)
6. [Index et Performance](#index-et-performance)

---

## 🎯 Vue d'Ensemble

Ce document décrit la structure complète de la base de données PostgreSQL du bot Discord.

### Principes Architecturaux

1. **Multi-Serveur**: Isolation par \`guild_id\` (TEXT)
2. **Soft Delete**: Utilisation de timestamps pour historique
3. **Performance**: Index optimisés sur clés fréquentes
4. **Contraintes**: Foreign keys avec ON DELETE CASCADE/SET NULL
5. **Auditabilité**: Tables de logs et timestamps

### Catégories de Tables

`;

  // Afficher les catégories
  for (const [category, tableList] of Object.entries(categories)) {
    if (tableList.length > 0) {
      const icon = getCategoryIcon(category);
      md += `- ${icon} **${formatCategoryName(category)}**: ${tableList.length} table(s)\n`;
    }
  }

  md += `\n---

## 🏗️ Architecture Multi-Serveur

**RÈGLE IMPÉRATIVE**: Toutes les requêtes SQL doivent inclure \`WHERE guild_id = $X\`.

### Colonnes Standard

\`\`\`sql
guild_id TEXT NOT NULL          -- ID du serveur Discord
id SERIAL PRIMARY KEY            -- ID unique auto-incrémenté
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
\`\`\`

### Pattern de Requête

\`\`\`javascript
// ✅ CORRECT
const result = await db.query(
  'SELECT * FROM players WHERE guild_id = $1 AND discord_id = $2',
  [guildId, discordId]
);

// ❌ INCORRECT - Manque guild_id
const result = await db.query(
  'SELECT * FROM players WHERE discord_id = $1',
  [discordId]
);
\`\`\`

---

## 📚 Tables par Catégorie

`;

  // Générer les sections par catégorie
  for (const [category, tableList] of Object.entries(categories)) {
    if (tableList.length === 0) continue;

    const icon = getCategoryIcon(category);
    md += `\n### ${icon} ${formatCategoryName(category)}\n\n`;

    for (const tableName of tableList) {
      const details = tableDetails[tableName];
      md += generateTableSummary(tableName, details);
    }
  }

  md += `\n---

## 📊 Schéma Détaillé

`;

  // Schéma détaillé de chaque table
  for (const [category, tableList] of Object.entries(categories)) {
    if (tableList.length === 0) continue;

    md += `\n### ${formatCategoryName(category)}\n\n`;

    for (const tableName of tableList) {
      const details = tableDetails[tableName];
      md += generateTableDetail(tableName, details);
    }
  }

  // Anomalies
  if (anomalies.length > 0) {
    md += `\n---

## ⚠️ Anomalies Détectées

${anomalies.length} anomalie(s) détectée(s) lors de l'audit:

`;
    anomalies.forEach((anomaly, i) => {
      md += `${i + 1}. **[${anomaly.table}]** ${anomaly.type}\n`;
      md += `   - ${anomaly.message}\n`;
      if (anomaly.detail) {
        md += `   - Détail: \`${anomaly.detail}\`\n`;
      }
      md += '\n';
    });
  }

  // Index et performance
  md += `\n---

## 🚀 Index et Performance

### Index Critiques

Les index suivants sont essentiels pour la performance:

\`\`\`sql
-- Multi-serveur (TOUTES les tables avec guild_id)
CREATE INDEX idx_tablename_guild ON table_name(guild_id);

-- Recherche par Discord ID
CREATE INDEX idx_players_discord_id ON players(guild_id, discord_id);

-- Badges actifs
CREATE INDEX idx_player_active_bonuses_active ON player_active_bonuses(guild_id, player_id, expires_at)
  WHERE expires_at > NOW();

-- Login streaks
CREATE INDEX idx_players_login_streak ON players(guild_id, current_login_streak DESC)
  WHERE current_login_streak > 0;
\`\`\`

### Recommandations

1. **Vacuum régulier**: \`VACUUM ANALYZE\` hebdomadaire
2. **Monitoring**: Surveiller \`pg_stat_user_tables\`
3. **Indexes partiels**: WHERE clauses pour filtrer données nulles/inactives
4. **Foreign keys**: Toujours avec ON DELETE CASCADE/SET NULL

---

## 📝 Notes pour Claude Code

### Avant Toute Modification DB

1. ✅ Lire ce fichier pour vérifier l'existence des colonnes
2. ✅ Vérifier les contraintes (CHECK, UNIQUE, FK)
3. ✅ Toujours inclure \`guild_id\` dans les requêtes
4. ✅ Créer une migration SQL versionnée
5. ✅ Tester avec un script Node.js avant déploiement

### Types de Colonnes Courants

| Type | Usage | Exemple |
|------|-------|---------|
| \`TEXT\` | IDs Discord, guild_id | \`'1248028543389143070'\` |
| \`INTEGER\` | IDs internes, compteurs | \`1, 42, 100\` |
| \`BOOLEAN\` | Flags | \`TRUE, FALSE\` |
| \`TIMESTAMP\` | Dates/heures | \`NOW(), '2025-11-20 20:00:00'\` |
| \`DATE\` | Dates seules | \`CURRENT_DATE, '2025-11-20'\` |
| \`JSONB\` | Données structurées | \`'{"key": "value"}'\` |

---

*Document généré automatiquement par audit-and-update-database-schema.js*
*Pour toute modification, régénérer avec: \`node scripts/audit-and-update-database-schema.js\`*
`;

  return md;
}

/**
 * Génère un résumé court d'une table
 */
function generateTableSummary(tableName, details) {
  const colCount = details.columns.length;
  const hasPK = details.primaryKey.length > 0;
  const fkCount = details.foreignKeys.length;
  const idxCount = details.indexes.length;

  let summary = `**\`${tableName}\`** (${colCount} colonnes`;
  if (fkCount > 0) summary += `, ${fkCount} FK`;
  if (idxCount > 0) summary += `, ${idxCount} index`;
  summary += ')\n';

  if (details.comment) {
    summary += `  *${details.comment}*\n`;
  }

  summary += '\n';
  return summary;
}

/**
 * Génère les détails complets d'une table
 */
function generateTableDetail(tableName, details) {
  let md = `#### \`${tableName}\`\n\n`;

  if (details.comment) {
    md += `> ${details.comment}\n\n`;
  }

  // Colonnes
  md += '**Colonnes:**\n\n';
  md += '| Colonne | Type | Nullable | Default |\n';
  md += '|---------|------|----------|----------|\n';

  for (const col of details.columns) {
    const type = formatDataType(col);
    const nullable = col.is_nullable === 'YES' ? 'Oui' : 'Non';
    const defaultVal = col.column_default ? `\`${col.column_default}\`` : '-';

    md += `| \`${col.column_name}\` | ${type} | ${nullable} | ${defaultVal} |\n`;
  }

  // Primary Key
  if (details.primaryKey.length > 0) {
    md += '\n**Primary Key:**\n\n';
    details.primaryKey.forEach(pk => {
      md += `- \`${pk.definition}\`\n`;
    });
  }

  // Contraintes UNIQUE
  if (details.unique.length > 0) {
    md += '\n**Contraintes UNIQUE:**\n\n';
    details.unique.forEach(u => {
      md += `- \`${u.conname}\`: ${u.definition}\n`;
    });
  }

  // Contraintes CHECK
  if (details.check.length > 0) {
    md += '\n**Contraintes CHECK:**\n\n';
    details.check.forEach(c => {
      md += `- \`${c.conname}\`: ${c.definition}\n`;
    });
  }

  // Foreign Keys
  if (details.foreignKeys.length > 0) {
    md += '\n**Foreign Keys:**\n\n';
    details.foreignKeys.forEach(fk => {
      md += `- \`${fk.conname}\`: ${fk.definition}\n`;
    });
  }

  // Référencée par (inbound FK)
  if (details.referencedBy.length > 0) {
    md += '\n**Référencée par:**\n\n';
    details.referencedBy.forEach(ref => {
      md += `- \`${ref.referencing_table}\` via \`${ref.conname}\`\n`;
    });
  }

  // Index
  if (details.indexes.length > 0) {
    md += '\n**Index:**\n\n';
    details.indexes.forEach(idx => {
      // Simplifier la définition d'index
      const def = idx.indexdef.replace(/CREATE (UNIQUE )?INDEX \w+ ON public\.\w+ USING \w+ /, '');
      md += `- \`${idx.indexname}\`: ${def}\n`;
    });
  }

  // Triggers
  if (details.triggers.length > 0) {
    md += '\n**Triggers:**\n\n';
    details.triggers.forEach(trigger => {
      md += `- \`${trigger.trigger_name}\` (${trigger.event_manipulation})\n`;
    });
  }

  md += '\n---\n\n';
  return md;
}

/**
 * Formate le type de données
 */
function formatDataType(col) {
  let type = col.data_type;

  if (type === 'character varying' && col.character_maximum_length) {
    type = `VARCHAR(${col.character_maximum_length})`;
  } else if (type === 'character varying') {
    type = 'TEXT';
  } else if (type === 'timestamp without time zone') {
    type = 'TIMESTAMP';
  } else if (type === 'USER-DEFINED') {
    type = col.udt_name.toUpperCase();
  } else {
    type = type.toUpperCase();
  }

  return type;
}

/**
 * Icônes par catégorie
 */
function getCategoryIcon(category) {
  const icons = {
    configuration: '⚙️',
    players: '👤',
    badges: '🏆',
    themes: '🎨',
    missions: '🎯',
    campaigns: '📢',
    super_admin: '👑',
    super_bonus: '✨',
    tracking: '📊',
    other: '📦'
  };
  return icons[category] || '📋';
}

/**
 * Formatte le nom de catégorie
 */
function formatCategoryName(category) {
  const names = {
    configuration: 'Configuration',
    players: 'Joueurs',
    badges: 'Badges',
    themes: 'Thèmes & Collectibles',
    missions: 'Missions',
    campaigns: 'Campagnes',
    super_admin: 'Super Admin',
    super_bonus: 'Super Bonus',
    tracking: 'Tracking & Logs',
    other: 'Autres'
  };
  return names[category] || category;
}

// Exécuter l'audit
auditDatabase();
