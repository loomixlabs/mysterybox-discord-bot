/**
 * Compare les schémas entre le backup VPS et la base locale
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function compareSchemas() {
  try {
    console.log('🔍 COMPARAISON DES SCHÉMAS: VPS vs LOCAL\n');
    console.log('='.repeat(80));

    // 1. Lire le backup VPS
    const backupPath = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');
    const backupContent = fs.readFileSync(backupPath, 'utf-8');

    // 2. Extraire les tables du backup VPS (CREATE TABLE statements)
    const vpsTableRegex = /CREATE TABLE (?:public\.)?(\w+)/gi;
    const vpsTables = new Set();
    let match;
    while ((match = vpsTableRegex.exec(backupContent)) !== null) {
      vpsTables.add(match[1].toLowerCase());
    }

    // 3. Récupérer les tables locales
    const localTablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const localTables = new Set(localTablesResult.rows.map(r => r.table_name.toLowerCase()));

    console.log('\n📊 RÉSUMÉ:');
    console.log(`   VPS: ${vpsTables.size} tables`);
    console.log(`   Local: ${localTables.size} tables`);

    // 4. Tables présentes sur VPS mais pas en local
    console.log('\n🔴 TABLES SUR VPS ABSENTES EN LOCAL:');
    const missingInLocal = [...vpsTables].filter(t => !localTables.has(t));
    if (missingInLocal.length === 0) {
      console.log('   ✅ Aucune');
    } else {
      missingInLocal.forEach(t => console.log(`   - ${t}`));
    }

    // 5. Tables présentes en local mais pas sur VPS
    console.log('\n🟡 TABLES EN LOCAL ABSENTES SUR VPS (Theme Builder):');
    const missingInVps = [...localTables].filter(t => !vpsTables.has(t));
    if (missingInVps.length === 0) {
      console.log('   ✅ Aucune');
    } else {
      missingInVps.forEach(t => console.log(`   - ${t}`));
    }

    // 6. Tables communes
    console.log('\n✅ TABLES COMMUNES:');
    const commonTables = [...vpsTables].filter(t => localTables.has(t));
    console.log(`   ${commonTables.length} tables communes`);

    // 7. Comparer les colonnes des tables communes
    console.log('\n📋 DIFFÉRENCES DE COLONNES (tables communes):');
    console.log('-'.repeat(80));

    for (const tableName of commonTables.sort()) {
      // Colonnes VPS (extraites du backup)
      const tableDefRegex = new RegExp(
        `CREATE TABLE (?:public\\.)?${tableName}\\s*\\(([^;]+?)\\);`,
        'is'
      );
      const tableMatch = backupContent.match(tableDefRegex);

      if (!tableMatch) continue;

      const vpsColumnRegex = /^\s*(\w+)\s+/gm;
      const vpsColumns = new Set();
      const tableDef = tableMatch[1];
      let colMatch;
      const lines = tableDef.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('CONSTRAINT') && !trimmed.startsWith('PRIMARY') && !trimmed.startsWith('UNIQUE') && !trimmed.startsWith('FOREIGN') && !trimmed.startsWith('CHECK')) {
          const colName = trimmed.split(/\s+/)[0];
          if (colName && !colName.startsWith('--')) {
            vpsColumns.add(colName.toLowerCase().replace(',', ''));
          }
        }
      }

      // Colonnes locales
      const localColsResult = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
      `, [tableName]);
      const localColumns = new Set(localColsResult.rows.map(r => r.column_name.toLowerCase()));

      // Comparer
      const missingInLocalCols = [...vpsColumns].filter(c => !localColumns.has(c));
      const missingInVpsCols = [...localColumns].filter(c => !vpsColumns.has(c));

      if (missingInLocalCols.length > 0 || missingInVpsCols.length > 0) {
        console.log(`\n📦 ${tableName}:`);
        if (missingInLocalCols.length > 0) {
          console.log(`   🔴 Colonnes VPS absentes en local: ${missingInLocalCols.join(', ')}`);
        }
        if (missingInVpsCols.length > 0) {
          console.log(`   🟡 Colonnes locales absentes sur VPS: ${missingInVpsCols.join(', ')}`);
        }
      }
    }

    // 8. Compter les données
    console.log('\n\n📈 COMPARAISON DES DONNÉES (nombre de lignes):');
    console.log('-'.repeat(80));
    console.log(String('Table').padEnd(35) + String('VPS').padStart(10) + String('Local').padStart(10) + String('Diff').padStart(10));
    console.log('-'.repeat(65));

    // Extraire les counts du backup VPS
    for (const tableName of commonTables.sort()) {
      // Count local
      const localCount = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
      const localRows = parseInt(localCount.rows[0].count);

      // Estimer count VPS (compter les COPY lines ou INSERT)
      const copyMatch = backupContent.match(new RegExp(`COPY public\\.${tableName} \\([^)]+\\) FROM stdin;([\\s\\S]*?)\\\\\\.`, 'i'));
      let vpsRows = 0;
      if (copyMatch) {
        vpsRows = copyMatch[1].trim().split('\n').filter(l => l.trim()).length;
      }

      const diff = vpsRows - localRows;
      const diffStr = diff > 0 ? `+${diff}` : diff.toString();

      if (diff !== 0) {
        console.log(
          tableName.padEnd(35) +
          String(vpsRows).padStart(10) +
          String(localRows).padStart(10) +
          diffStr.padStart(10)
        );
      }
    }

    await pool.end();
    console.log('\n' + '='.repeat(80));
    console.log('✅ Comparaison terminée\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
    await pool.end();
    process.exit(1);
  }
}

compareSchemas();
