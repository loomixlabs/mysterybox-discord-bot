/**
 * Merge COMPLET des données VPS vers Local
 * - Importe TOUTES les tables du backup VPS
 * - Ajoute les nouvelles entrées (INSERT ON CONFLICT DO NOTHING)
 * - Ne supprime RIEN en local
 * - Ne touche pas aux tables qui n'existent pas sur VPS
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fullMerge() {
  try {
    console.log('🔄 MERGE COMPLET VPS → LOCAL (toutes les tables)\n');
    console.log('='.repeat(80));

    // Lire le backup VPS
    const backupPath = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');
    const backupContent = fs.readFileSync(backupPath, 'utf-8');

    // Extraire toutes les tables du backup VPS
    const copyRegex = /COPY public\.(\w+) \(([^)]+)\) FROM stdin;([\s\S]*?)\\\./g;
    const vpsTables = [];
    let match;

    while ((match = copyRegex.exec(backupContent)) !== null) {
      const tableName = match[1];
      const columns = match[2].split(',').map(c => c.trim());
      const dataLines = match[3].trim().split('\n').filter(l => l.trim());

      if (dataLines.length > 0) {
        vpsTables.push({ tableName, columns, dataLines });
      }
    }

    console.log(`📋 Tables trouvées dans le backup VPS: ${vpsTables.length}`);
    console.log('   ' + vpsTables.map(t => t.tableName).join(', '));
    console.log('\n' + '-'.repeat(80));

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const { tableName, columns, dataLines } of vpsTables) {
      // Vérifier si la table existe en local
      const tableExists = await pool.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);

      if (tableExists.rows.length === 0) {
        console.log(`⏭️  ${tableName}: Table n'existe pas en local, skip`);
        continue;
      }

      // Compter les lignes locales actuelles
      const localCount = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
      const localRows = parseInt(localCount.rows[0].count);

      console.log(`\n📦 ${tableName}: ${dataLines.length} lignes VPS, ${localRows} lignes locales`);

      // Vérifier quelles colonnes existent en local
      const localColsResult = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
      `, [tableName]);
      const localColumns = new Set(localColsResult.rows.map(r => r.column_name));

      // Filtrer les colonnes qui existent en local
      const validColumns = columns.filter(c => localColumns.has(c));
      const invalidColumns = columns.filter(c => !localColumns.has(c));

      if (invalidColumns.length > 0) {
        console.log(`   ⚠️  Colonnes VPS absentes en local: ${invalidColumns.join(', ')}`);
      }

      if (validColumns.length === 0) {
        console.log(`   ❌ Aucune colonne valide, skip`);
        continue;
      }

      let inserted = 0;
      let skipped = 0;
      let errors = 0;

      for (const line of dataLines) {
        const values = line.split('\t');

        // Construire les données avec seulement les colonnes valides
        const data = {};
        columns.forEach((col, idx) => {
          if (localColumns.has(col)) {
            let val = values[idx];
            if (val === '\\N') val = null;
            data[col] = val;
          }
        });

        try {
          // Construire la requête INSERT ON CONFLICT DO NOTHING
          const insertCols = Object.keys(data);
          const insertVals = Object.values(data);
          const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');

          const result = await pool.query(
            `INSERT INTO ${tableName} (${insertCols.join(', ')})
             VALUES (${placeholders})
             ON CONFLICT DO NOTHING`,
            insertVals
          );

          if (result.rowCount > 0) {
            inserted++;
          } else {
            skipped++;
          }

        } catch (err) {
          errors++;
          // Log seulement les premières erreurs
          if (errors <= 3) {
            console.log(`   ❌ ${err.message.substring(0, 60)}...`);
          }
        }
      }

      console.log(`   ✅ Insérées: ${inserted}, Existantes: ${skipped}${errors > 0 ? `, Erreurs: ${errors}` : ''}`);
      totalInserted += inserted;
      totalSkipped += skipped;
      totalErrors += errors;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 RÉSUMÉ GLOBAL:`);
    console.log(`   ✅ Nouvelles entrées insérées: ${totalInserted}`);
    console.log(`   ⏭️  Entrées existantes (ignorées): ${totalSkipped}`);
    if (totalErrors > 0) {
      console.log(`   ❌ Erreurs (FK/contraintes): ${totalErrors}`);
    }
    console.log(`\n✅ Merge complet terminé!`);

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await pool.end();
    process.exit(1);
  }
}

fullMerge();
