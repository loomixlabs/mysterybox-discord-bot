/**
 * Comparaison exhaustive des schémas DB: Local vs VPS
 * Compare: tables, colonnes, types, contraintes, index
 */

const { Client } = require('pg');

// Configuration
const LOCAL_DB = {
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
};

const VPS_DB = {
  host: '72.60.185.62',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
};

async function getSchemaInfo(client, dbName) {
  console.log(`\n📊 Extraction schéma ${dbName}...`);

  // 1. Tables
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  // 2. Colonnes par table
  const columns = await client.query(`
    SELECT table_name, column_name, data_type, column_default, is_nullable,
           character_maximum_length, numeric_precision
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  // 3. Contraintes (CHECK, UNIQUE, FK, PK)
  const constraints = await client.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
           kcu.column_name, ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `);

  // 4. CHECK constraints avec définition
  const checkConstraints = await client.query(`
    SELECT conname, conrelid::regclass as table_name, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE contype = 'c' AND connamespace = 'public'::regnamespace
    ORDER BY conrelid::regclass::text, conname
  `);

  // 5. Index
  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  return {
    tables: tables.rows.map(r => r.table_name),
    columns: columns.rows,
    constraints: constraints.rows,
    checkConstraints: checkConstraints.rows,
    indexes: indexes.rows
  };
}

function compareArrays(local, vps, itemName) {
  const localSet = new Set(local);
  const vpsSet = new Set(vps);

  const missing = local.filter(x => !vpsSet.has(x));
  const extra = vps.filter(x => !localSet.has(x));

  if (missing.length > 0) {
    console.log(`  ❌ ${itemName} manquant(s) sur VPS: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    console.log(`  ⚠️  ${itemName} en plus sur VPS: ${extra.join(', ')}`);
  }
  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ✅ ${itemName}: Identiques`);
  }

  return { missing, extra };
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 COMPARAISON EXHAUSTIVE DES SCHÉMAS DB');
  console.log('='.repeat(80));

  let localClient, vpsClient;
  let differences = [];

  try {
    // Connexion aux deux DB
    localClient = new Client(LOCAL_DB);
    await localClient.connect();
    console.log('✅ Connecté à LOCAL');

    vpsClient = new Client(VPS_DB);
    await vpsClient.connect();
    console.log('✅ Connecté à VPS');

    // Extraction des schémas
    const localSchema = await getSchemaInfo(localClient, 'LOCAL');
    const vpsSchema = await getSchemaInfo(vpsClient, 'VPS');

    // 1. COMPARAISON DES TABLES
    console.log('\n' + '='.repeat(80));
    console.log('📋 1. TABLES');
    console.log('='.repeat(80));
    console.log(`  Local: ${localSchema.tables.length} tables`);
    console.log(`  VPS: ${vpsSchema.tables.length} tables`);

    const tableDiff = compareArrays(localSchema.tables, vpsSchema.tables, 'Tables');
    if (tableDiff.missing.length > 0) {
      differences.push({ type: 'TABLES_MANQUANTES', items: tableDiff.missing });
    }

    // 2. COMPARAISON DES COLONNES
    console.log('\n' + '='.repeat(80));
    console.log('📊 2. COLONNES');
    console.log('='.repeat(80));

    // Grouper colonnes par table
    const localCols = {};
    const vpsCols = {};

    localSchema.columns.forEach(c => {
      if (!localCols[c.table_name]) localCols[c.table_name] = {};
      localCols[c.table_name][c.column_name] = c;
    });

    vpsSchema.columns.forEach(c => {
      if (!vpsCols[c.table_name]) vpsCols[c.table_name] = {};
      vpsCols[c.table_name][c.column_name] = c;
    });

    // Pour chaque table locale, vérifier les colonnes
    for (const table of localSchema.tables) {
      if (!vpsCols[table]) {
        console.log(`  ❌ Table ${table}: ABSENTE du VPS`);
        continue;
      }

      const localColNames = Object.keys(localCols[table] || {});
      const vpsColNames = Object.keys(vpsCols[table] || {});

      const missingCols = localColNames.filter(c => !vpsColNames.includes(c));

      if (missingCols.length > 0) {
        console.log(`  ❌ Table ${table}: Colonnes manquantes VPS: ${missingCols.join(', ')}`);
        differences.push({ type: 'COLONNES_MANQUANTES', table, columns: missingCols });
      }

      // Vérifier les types de colonnes
      for (const colName of localColNames) {
        if (!vpsCols[table]?.[colName]) continue;

        const localCol = localCols[table][colName];
        const vpsCol = vpsCols[table][colName];

        if (localCol.data_type !== vpsCol.data_type) {
          console.log(`  ⚠️  ${table}.${colName}: Type différent (Local: ${localCol.data_type}, VPS: ${vpsCol.data_type})`);
          differences.push({ type: 'TYPE_DIFFERENT', table, column: colName, local: localCol.data_type, vps: vpsCol.data_type });
        }
      }
    }

    if (differences.filter(d => d.type === 'COLONNES_MANQUANTES').length === 0) {
      console.log('  ✅ Toutes les colonnes présentes');
    }

    // 3. COMPARAISON DES CONTRAINTES CHECK
    console.log('\n' + '='.repeat(80));
    console.log('🔒 3. CONTRAINTES CHECK');
    console.log('='.repeat(80));

    const localChecks = localSchema.checkConstraints.map(c => `${c.table_name}.${c.conname}`);
    const vpsChecks = vpsSchema.checkConstraints.map(c => `${c.table_name}.${c.conname}`);

    const checkDiff = compareArrays(localChecks, vpsChecks, 'Contraintes CHECK');
    if (checkDiff.missing.length > 0) {
      differences.push({ type: 'CHECK_MANQUANTES', items: checkDiff.missing });
    }

    // 4. COMPARAISON DES INDEX
    console.log('\n' + '='.repeat(80));
    console.log('📈 4. INDEX');
    console.log('='.repeat(80));

    const localIdx = localSchema.indexes.map(i => `${i.tablename}.${i.indexname}`);
    const vpsIdx = vpsSchema.indexes.map(i => `${i.tablename}.${i.indexname}`);

    const idxDiff = compareArrays(localIdx, vpsIdx, 'Index');
    if (idxDiff.missing.length > 0) {
      differences.push({ type: 'INDEX_MANQUANTS', items: idxDiff.missing });
    }

    // RÉSUMÉ FINAL
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(80));

    if (differences.length === 0) {
      console.log('✅ Les schémas sont IDENTIQUES !');
    } else {
      console.log(`❌ ${differences.length} différence(s) trouvée(s):`);
      differences.forEach((d, i) => {
        console.log(`  ${i+1}. ${d.type}:`, JSON.stringify(d.items || d.columns || d));
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (localClient) await localClient.end();
    if (vpsClient) await vpsClient.end();
  }
}

main();
