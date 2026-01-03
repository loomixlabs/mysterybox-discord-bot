/**
 * Script pour comparer les schémas de tables entre local et VPS
 * Vérifie qu'il n'y a pas de conflits de colonnes avant la synchronisation
 */
const db = require('../utils/database-pg');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Tables Theme Builder à ignorer (ne sont pas sur le VPS)
const THEME_BUILDER_TABLES = [
  'banned_builder_users',
  'theme_builder_config',
  'theme_builder_logs',
  'theme_builder_sessions',
  'theme_builder_user_quotas',
  'themes_library'
];

async function getLocalSchema() {
  console.log('📊 Récupération du schéma LOCAL...\n');

  const tables = await db.queryAll(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  const schema = {};

  for (const t of tables) {
    const tableName = t.table_name;

    // Ignorer les tables Theme Builder
    if (THEME_BUILDER_TABLES.includes(tableName)) {
      continue;
    }

    const columns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    schema[tableName] = columns.map(c => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable,
      default: c.column_default,
      maxLength: c.character_maximum_length
    }));
  }

  return schema;
}

async function getVPSSchema() {
  console.log('🌐 Récupération du schéma VPS via SSH...\n');

  const sshCmd = `ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62 "docker exec bot-mysterybox-db psql -U botuser -d botdb -t -A -c \\"
    SELECT json_agg(row_to_json(t)) FROM (
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length
      FROM information_schema.columns c
      JOIN information_schema.tables t ON c.table_name = t.table_name
      WHERE c.table_schema = 'public' AND t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position
    ) t;
  \\""`;

  try {
    const { stdout } = await execPromise(sshCmd, { maxBuffer: 10 * 1024 * 1024 });
    const data = JSON.parse(stdout.trim());

    // Organiser par table
    const schema = {};
    for (const row of data) {
      if (!schema[row.table_name]) {
        schema[row.table_name] = [];
      }
      schema[row.table_name].push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
        default: row.column_default,
        maxLength: row.character_maximum_length
      });
    }

    return schema;
  } catch (error) {
    console.error('❌ Erreur SSH:', error.message);
    throw error;
  }
}

function compareSchemas(localSchema, vpsSchema) {
  console.log('\n🔍 COMPARAISON DES SCHÉMAS\n');
  console.log('='.repeat(80));

  const conflicts = [];
  const localOnly = [];
  const vpsOnly = [];
  const identical = [];

  // Tables présentes uniquement en local (hors Theme Builder)
  for (const tableName of Object.keys(localSchema)) {
    if (!vpsSchema[tableName]) {
      localOnly.push(tableName);
    }
  }

  // Tables présentes uniquement sur VPS
  for (const tableName of Object.keys(vpsSchema)) {
    if (!localSchema[tableName]) {
      vpsOnly.push(tableName);
    }
  }

  // Comparer les tables communes
  for (const tableName of Object.keys(localSchema)) {
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

    // Colonnes en local uniquement
    for (const colName of Object.keys(localColMap)) {
      if (!vpsColMap[colName]) {
        colsLocalOnly.push(colName);
      }
    }

    // Colonnes VPS uniquement
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

      if (local.type !== vps.type) {
        tableConflicts.push({
          column: colName,
          issue: 'TYPE_MISMATCH',
          local: local.type,
          vps: vps.type
        });
      }

      // Vérifier nullable (VPS NOT NULL, local NULL = problème potentiel)
      if (vps.nullable === 'NO' && local.nullable === 'YES') {
        tableConflicts.push({
          column: colName,
          issue: 'NULLABLE_CONFLICT',
          local: 'NULL allowed',
          vps: 'NOT NULL'
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

  return { conflicts, localOnly, vpsOnly, identical };
}

function printReport(result) {
  const { conflicts, localOnly, vpsOnly, identical } = result;

  console.log('\n📊 RAPPORT DE COMPARAISON\n');
  console.log('='.repeat(80));

  // Tables identiques
  console.log(`\n✅ TABLES IDENTIQUES: ${identical.length}`);
  if (identical.length > 0) {
    console.log('   ' + identical.join(', '));
  }

  // Tables local uniquement
  console.log(`\n📦 TABLES LOCAL UNIQUEMENT: ${localOnly.length}`);
  if (localOnly.length > 0) {
    localOnly.forEach(t => console.log(`   - ${t}`));
  }

  // Tables VPS uniquement
  console.log(`\n🌐 TABLES VPS UNIQUEMENT: ${vpsOnly.length}`);
  if (vpsOnly.length > 0) {
    vpsOnly.forEach(t => console.log(`   - ${t}`));
  }

  // Conflits
  console.log(`\n⚠️  TABLES AVEC DIFFÉRENCES: ${conflicts.length}`);

  let criticalConflicts = 0;

  for (const c of conflicts) {
    console.log(`\n   📋 ${c.table}:`);

    if (c.typeConflicts.length > 0) {
      console.log('      🔴 CONFLITS DE TYPE:');
      for (const tc of c.typeConflicts) {
        console.log(`         - ${tc.column}: Local=${tc.local} vs VPS=${tc.vps}`);
        criticalConflicts++;
      }
    }

    if (c.localOnlyColumns.length > 0) {
      console.log('      🟡 Colonnes LOCAL uniquement:');
      console.log(`         ${c.localOnlyColumns.join(', ')}`);
    }

    if (c.vpsOnlyColumns.length > 0) {
      console.log('      🟠 Colonnes VPS uniquement (seront ajoutées):');
      console.log(`         ${c.vpsOnlyColumns.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));

  if (criticalConflicts > 0) {
    console.log(`\n🔴 ATTENTION: ${criticalConflicts} conflit(s) de type critique(s) détecté(s)!`);
    console.log('   Ces conflits doivent être résolus AVANT la synchronisation.');
    return false;
  } else if (conflicts.length > 0) {
    console.log('\n🟡 Des différences de colonnes ont été détectées.');
    console.log('   Les colonnes VPS uniquement seront ajoutées lors de la restauration.');
    console.log('   Les colonnes local uniquement seront PERDUES.');
    return true;
  } else {
    console.log('\n✅ Aucun conflit détecté! La synchronisation peut procéder.');
    return true;
  }
}

async function main() {
  try {
    console.log('🔄 COMPARAISON SCHÉMAS LOCAL vs VPS\n');
    console.log('='.repeat(80));
    console.log('Tables Theme Builder ignorées:', THEME_BUILDER_TABLES.join(', '));
    console.log('='.repeat(80));

    const localSchema = await getLocalSchema();
    console.log(`   ✅ ${Object.keys(localSchema).length} tables locales (hors Theme Builder)`);

    const vpsSchema = await getVPSSchema();
    console.log(`   ✅ ${Object.keys(vpsSchema).length} tables VPS`);

    const result = compareSchemas(localSchema, vpsSchema);
    const canProceed = printReport(result);

    if (canProceed) {
      console.log('\n✅ La synchronisation VPS → Local peut procéder en toute sécurité.');
    } else {
      console.log('\n❌ Résoudre les conflits avant de procéder.');
    }

    process.exit(canProceed ? 0 : 1);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
