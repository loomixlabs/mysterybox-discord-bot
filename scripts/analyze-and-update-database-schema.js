const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function analyzeDatabase() {
  console.log('🔍 ANALYSE COMPLÈTE DE LA BASE DE DONNÉES\n');
  console.log('='.repeat(100));

  try {
    // 1. Lister toutes les tables
    console.log('\n📋 Étape 1: Récupération de toutes les tables...');
    const tablesResult = await pool.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`✅ ${tables.length} tables trouvées:`);
    console.log(tables.map(t => `   - ${t}`).join('\n'));

    // 2. Pour chaque table, récupérer la structure complète
    console.log('\n📋 Étape 2: Analyse de la structure de chaque table...');
    const schema = {};

    for (const tableName of tables) {
      console.log(`\n🔍 Analyse de la table "${tableName}"...`);

      // Colonnes
      const columnsResult = await pool.query(`
        SELECT
          column_name,
          data_type,
          column_default,
          is_nullable,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      // Clés primaires
      const pkResult = await pool.query(`
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary
      `, [tableName]);

      // Clés étrangères
      const fkResult = await pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
      `, [tableName]);

      // Index
      const indexResult = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1
          AND schemaname = 'public'
      `, [tableName]);

      // Contraintes CHECK
      const checkResult = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass AND contype = 'c'
      `, [tableName]);

      // Contraintes UNIQUE
      const uniqueResult = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass AND contype = 'u'
      `, [tableName]);

      schema[tableName] = {
        columns: columnsResult.rows,
        primaryKeys: pkResult.rows.map(r => r.column_name),
        foreignKeys: fkResult.rows,
        indexes: indexResult.rows,
        checkConstraints: checkResult.rows,
        uniqueConstraints: uniqueResult.rows
      };

      console.log(`   ✅ ${columnsResult.rows.length} colonnes, ${pkResult.rows.length} PK, ${fkResult.rows.length} FK, ${indexResult.rows.length} index`);
    }

    // 3. Générer le fichier DATABASE-SCHEMA.md
    console.log('\n📄 Étape 3: Génération du fichier DATABASE-SCHEMA.md...');

    let markdown = `# 📊 DATABASE SCHEMA - Base de Données PostgreSQL\n\n`;
    markdown += `> **Généré automatiquement le**: ${new Date().toLocaleString('fr-FR')}\n`;
    markdown += `> **Nombre de tables**: ${tables.length}\n`;
    markdown += `> **Base de données**: botdb\n\n`;
    markdown += `---\n\n`;

    // Catégoriser les tables
    const categories = {
      'Configuration': ['themes', 'collectibles', 'traps', 'theme_messages', 'theme_config', 'guild_config', 'announcement_settings', 'announcement_templates', 'announcement_channel', 'colors'],
      'Joueurs': ['players', 'player_progress', 'player_cooldowns', 'player_malus_points', 'player_active_bonuses', 'collections'],
      'Missions & Quiz': ['missions', 'mission_progress', 'mission_keywords', 'quiz_questions'],
      'Mystery Boxes & Gives': ['give_campaigns', 'give_channels', 'give_logs'],
      'Pièges': ['traps', 'trap_triggered'],
      'Super Bonus': ['super_bonuses', 'bonus_usage_history'],
      'Super Admin': ['super_admins', 'super_admin_logs'],
      'Audit': ['audit_logs']
    };

    markdown += `## 📑 Tables par Catégorie\n\n`;
    for (const [category, tableList] of Object.entries(categories)) {
      const foundTables = tableList.filter(t => tables.includes(t));
      markdown += `### ${category} (${foundTables.length} tables)\n\n`;
      foundTables.forEach(t => {
        markdown += `- **${t}** (${schema[t].columns.length} colonnes)\n`;
      });
      markdown += `\n`;
    }

    // Autres tables non catégorisées
    const categorizedTables = new Set(Object.values(categories).flat());
    const uncategorized = tables.filter(t => !categorizedTables.has(t));
    if (uncategorized.length > 0) {
      markdown += `### Autres (${uncategorized.length} tables)\n\n`;
      uncategorized.forEach(t => {
        markdown += `- **${t}** (${schema[t].columns.length} colonnes)\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `## 📋 Structure Détaillée des Tables\n\n`;

    // Générer la structure de chaque table
    for (const tableName of tables) {
      const table = schema[tableName];

      markdown += `### \`${tableName}\`\n\n`;

      // Description des colonnes
      markdown += `**Colonnes:**\n\n`;
      markdown += `| Colonne | Type | Default | Nullable | Longueur Max |\n`;
      markdown += `|---------|------|---------|----------|-------------|\n`;
      table.columns.forEach(col => {
        const pk = table.primaryKeys.includes(col.column_name) ? ' 🔑' : '';
        markdown += `| ${col.column_name}${pk} | ${col.data_type} | ${col.column_default || '-'} | ${col.is_nullable} | ${col.character_maximum_length || '-'} |\n`;
      });
      markdown += `\n`;

      // Clés primaires
      if (table.primaryKeys.length > 0) {
        markdown += `**Clés Primaires:** ${table.primaryKeys.map(k => `\`${k}\``).join(', ')}\n\n`;
      }

      // Clés étrangères
      if (table.foreignKeys.length > 0) {
        markdown += `**Clés Étrangères:**\n\n`;
        table.foreignKeys.forEach(fk => {
          markdown += `- \`${fk.column_name}\` → \`${fk.foreign_table_name}.${fk.foreign_column_name}\`\n`;
        });
        markdown += `\n`;
      }

      // Contraintes CHECK
      if (table.checkConstraints.length > 0) {
        markdown += `**Contraintes CHECK:**\n\n`;
        table.checkConstraints.forEach(check => {
          markdown += `- \`${check.conname}\`: ${check.definition}\n`;
        });
        markdown += `\n`;
      }

      // Contraintes UNIQUE
      if (table.uniqueConstraints.length > 0) {
        markdown += `**Contraintes UNIQUE:**\n\n`;
        table.uniqueConstraints.forEach(unique => {
          markdown += `- \`${unique.conname}\`: ${unique.definition}\n`;
        });
        markdown += `\n`;
      }

      // Index
      if (table.indexes.length > 0) {
        markdown += `**Index:**\n\n`;
        table.indexes.forEach(idx => {
          markdown += `- \`${idx.indexname}\`\n`;
        });
        markdown += `\n`;
      }

      markdown += `---\n\n`;
    }

    // Écrire le fichier
    const schemaPath = path.join(__dirname, '../DATABASE-SCHEMA.md');
    fs.writeFileSync(schemaPath, markdown, 'utf8');

    console.log(`✅ Fichier DATABASE-SCHEMA.md créé avec succès!`);
    console.log(`📁 Emplacement: ${schemaPath}`);

    // 4. Résumé
    console.log('\n' + '='.repeat(100));
    console.log('📊 RÉSUMÉ DE L\'ANALYSE');
    console.log('='.repeat(100));

    console.log(`\n✅ ${tables.length} tables analysées`);
    console.log(`✅ Schéma complet généré dans DATABASE-SCHEMA.md`);

    // Table avec le plus de colonnes
    const maxCols = Math.max(...Object.values(schema).map(t => t.columns.length));
    const tableMaxCols = Object.keys(schema).find(t => schema[t].columns.length === maxCols);
    console.log(`\n📊 Table avec le plus de colonnes: ${tableMaxCols} (${maxCols} colonnes)`);

    // Tables sans clé primaire
    const noPK = Object.keys(schema).filter(t => schema[t].primaryKeys.length === 0);
    if (noPK.length > 0) {
      console.log(`\n⚠️  Tables sans clé primaire: ${noPK.join(', ')}`);
    }

    console.log('\n' + '='.repeat(100) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'analyse:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

analyzeDatabase();
