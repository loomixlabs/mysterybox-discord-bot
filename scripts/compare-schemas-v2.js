/**
 * Script pour comparer les schémas de tables entre local et VPS
 * Utilise le fichier temp_vps_schema.txt exporté depuis le VPS
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

// Tables Theme Builder à IGNORER (ne seront pas écrasées)
const THEME_BUILDER_TABLES = [
  'banned_builder_users',
  'theme_builder_config',
  'theme_builder_logs',
  'theme_builder_sessions',
  'theme_builder_user_quotas',
  'themes_library'
];

function parseVPSSchema(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.length > 0);

  const schema = {};

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 4) continue;

    const [tableName, columnName, dataType, isNullable] = parts;

    if (!schema[tableName]) {
      schema[tableName] = [];
    }

    schema[tableName].push({
      name: columnName,
      type: dataType,
      nullable: isNullable
    });
  }

  return schema;
}

async function getLocalSchema() {
  const tables = await db.queryAll(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  const schema = {};

  for (const t of tables) {
    const tableName = t.table_name;

    const columns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    schema[tableName] = columns.map(c => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable
    }));
  }

  return schema;
}

function compareSchemas(localSchema, vpsSchema) {
  const conflicts = [];
  const localOnly = [];
  const vpsOnly = [];
  const identical = [];
  const themeBuilderTables = [];

  // Tables présentes uniquement en local
  for (const tableName of Object.keys(localSchema)) {
    if (THEME_BUILDER_TABLES.includes(tableName)) {
      themeBuilderTables.push(tableName);
      continue;
    }
    if (!vpsSchema[tableName]) {
      localOnly.push(tableName);
    }
  }

  // Tables présentes uniquement sur VPS
  for (const tableName of Object.keys(vpsSchema)) {
    if (THEME_BUILDER_TABLES.includes(tableName)) {
      continue; // Ignorer
    }
    if (!localSchema[tableName]) {
      vpsOnly.push(tableName);
    }
  }

  // Comparer les tables communes
  for (const tableName of Object.keys(localSchema)) {
    if (THEME_BUILDER_TABLES.includes(tableName)) continue;
    if (!vpsSchema[tableName]) continue;

    const localCols = localSchema[tableName];
    const vpsCols = vpsSchema[tableName];

    const localColMap = {};
    localCols.forEach(c => localColMap[c.name] = c);

    const vpsColMap = {};
    vpsCols.forEach(c => vpsColMap[c.name] = c);

    let tableConflicts = [];
    let colsLocalOnly = [];
    let colsVpsOnly = [];

    // Colonnes en local uniquement (seront perdues)
    for (const colName of Object.keys(localColMap)) {
      if (!vpsColMap[colName]) {
        colsLocalOnly.push(colName);
      }
    }

    // Colonnes VPS uniquement (seront ajoutées)
    for (const colName of Object.keys(vpsColMap)) {
      if (!localColMap[colName]) {
        colsVpsOnly.push(colName);
      }
    }

    // Colonnes communes - vérifier les types
    for (const colName of Object.keys(localColMap)) {
      if (!vpsColMap[colName]) continue;

      const local = localColMap[colName];
      const vps = vpsColMap[colName];

      // Normaliser les types pour comparaison
      const normalizeType = (t) => {
        return t.replace('character varying', 'varchar')
                .replace('timestamp without time zone', 'timestamp')
                .replace('timestamp with time zone', 'timestamptz');
      };

      if (normalizeType(local.type) !== normalizeType(vps.type)) {
        tableConflicts.push({
          column: colName,
          issue: 'TYPE_MISMATCH',
          local: local.type,
          vps: vps.type
        });
      }
    }

    if (tableConflicts.length > 0 || colsLocalOnly.length > 0 || colsVpsOnly.length > 0) {
      conflicts.push({
        table: tableName,
        typeConflicts: tableConflicts,
        localOnlyColumns: colsLocalOnly,
        vpsOnlyColumns: colsVpsOnly
      });
    } else {
      identical.push(tableName);
    }
  }

  return { conflicts, localOnly, vpsOnly, identical, themeBuilderTables };
}

function printReport(result) {
  const { conflicts, localOnly, vpsOnly, identical, themeBuilderTables } = result;

  console.log('\n📊 RAPPORT DE COMPARAISON LOCAL vs VPS\n');
  console.log('='.repeat(80));

  // Theme Builder tables
  console.log(`\n🎨 TABLES THEME BUILDER (ignorées): ${themeBuilderTables.length}`);
  console.log('   ' + themeBuilderTables.join(', '));

  // Tables identiques
  console.log(`\n✅ TABLES IDENTIQUES: ${identical.length}`);
  if (identical.length <= 10) {
    console.log('   ' + identical.join(', '));
  } else {
    console.log('   ' + identical.slice(0, 10).join(', ') + `... et ${identical.length - 10} autres`);
  }

  // Tables local uniquement (seront PERDUES)
  console.log(`\n📦 TABLES LOCAL UNIQUEMENT (seront perdues): ${localOnly.length}`);
  if (localOnly.length > 0) {
    localOnly.forEach(t => console.log(`   ⚠️  ${t}`));
  }

  // Tables VPS uniquement (seront ajoutées)
  console.log(`\n🌐 TABLES VPS UNIQUEMENT (seront créées): ${vpsOnly.length}`);
  if (vpsOnly.length > 0) {
    vpsOnly.forEach(t => console.log(`   ➕ ${t}`));
  }

  // Conflits
  let criticalConflicts = 0;
  let columnDifferences = 0;

  console.log(`\n⚠️  TABLES AVEC DIFFÉRENCES: ${conflicts.length}`);

  for (const c of conflicts) {
    const hasTypeConflict = c.typeConflicts.length > 0;
    const hasLocalOnly = c.localOnlyColumns.length > 0;
    const hasVpsOnly = c.vpsOnlyColumns.length > 0;

    if (hasTypeConflict) {
      console.log(`\n   🔴 ${c.table}: CONFLIT DE TYPE`);
      for (const tc of c.typeConflicts) {
        console.log(`      ${tc.column}: Local="${tc.local}" vs VPS="${tc.vps}"`);
        criticalConflicts++;
      }
    }

    if (hasLocalOnly && !hasTypeConflict) {
      console.log(`\n   🟡 ${c.table}:`);
    }

    if (hasLocalOnly) {
      console.log(`      Colonnes LOCAL uniquement (seront perdues): ${c.localOnlyColumns.join(', ')}`);
      columnDifferences += c.localOnlyColumns.length;
    }

    if (hasVpsOnly) {
      console.log(`      Colonnes VPS uniquement (seront ajoutées): ${c.vpsOnlyColumns.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📋 RÉSUMÉ:');
  console.log(`   - Tables identiques: ${identical.length}`);
  console.log(`   - Tables Theme Builder (préservées): ${themeBuilderTables.length}`);
  console.log(`   - Tables à créer depuis VPS: ${vpsOnly.length}`);
  console.log(`   - Tables locales à perdre: ${localOnly.length}`);
  console.log(`   - Conflits de type critiques: ${criticalConflicts}`);
  console.log(`   - Colonnes locales à perdre: ${columnDifferences}`);

  if (criticalConflicts > 0) {
    console.log(`\n🔴 ATTENTION: ${criticalConflicts} conflit(s) de type détecté(s)!`);
    console.log('   Le schéma VPS diffère du local sur des types de colonnes.');
    console.log('   La restauration va ÉCRASER ces définitions avec celles du VPS.');
    return { canProceed: true, hasCritical: true };
  } else if (columnDifferences > 0 || localOnly.length > 0) {
    console.log('\n🟡 Des différences ont été détectées.');
    console.log('   Certaines colonnes/tables locales seront perdues.');
    return { canProceed: true, hasCritical: false };
  } else {
    console.log('\n✅ Schémas compatibles! La synchronisation peut procéder en sécurité.');
    return { canProceed: true, hasCritical: false };
  }
}

async function main() {
  try {
    console.log('🔄 COMPARAISON SCHÉMAS LOCAL vs VPS\n');
    console.log('='.repeat(80));

    const vpsSchemaFile = path.join(__dirname, '..', 'temp_vps_schema.txt');

    if (!fs.existsSync(vpsSchemaFile)) {
      console.error('❌ Fichier temp_vps_schema.txt non trouvé!');
      console.log('   Exécutez d\'abord la commande SSH pour exporter le schéma VPS.');
      process.exit(1);
    }

    console.log('📊 Lecture du schéma VPS depuis temp_vps_schema.txt...');
    const vpsSchema = parseVPSSchema(vpsSchemaFile);
    console.log(`   ✅ ${Object.keys(vpsSchema).length} tables VPS parsées`);

    console.log('\n📊 Récupération du schéma LOCAL...');
    const localSchema = await getLocalSchema();
    console.log(`   ✅ ${Object.keys(localSchema).length} tables locales`);

    const result = compareSchemas(localSchema, vpsSchema);
    const { canProceed, hasCritical } = printReport(result);

    if (canProceed) {
      console.log('\n✅ La synchronisation VPS → Local peut procéder.');
      if (hasCritical) {
        console.log('⚠️  ATTENTION: Des différences de schéma existent - les données locales seront écrasées.');
      }
    }

    // Nettoyer le fichier temp
    // fs.unlinkSync(vpsSchemaFile);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
