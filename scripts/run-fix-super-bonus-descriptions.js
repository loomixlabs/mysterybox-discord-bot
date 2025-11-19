/**
 * Script d'exécution de la migration fix-super-bonus-descriptions.sql
 * Nettoie les descriptions des super bonus (enlève durées/charges hardcodées)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  console.log('🔧 MIGRATION: Fix Super Bonus Descriptions\n');
  console.log('='.repeat(80));

  try {
    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'fix-super-bonus-descriptions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('\n📋 Contenu de la migration:\n');
    console.log(sql);
    console.log('\n' + '='.repeat(80));

    // Afficher état AVANT
    console.log('\n📊 ÉTAT AVANT MIGRATION:\n');
    const before = await pool.query(`
      SELECT bonus_id, name, description
      FROM super_bonuses
      ORDER BY id
    `);
    console.table(before.rows);

    // Demander confirmation
    console.log('\n⚠️  Appuyez sur CTRL+C pour annuler, ou attendez 3 secondes...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Exécuter la migration
    console.log('\n🚀 Exécution de la migration...\n');
    await pool.query(sql);
    console.log('✅ Migration exécutée avec succès !');

    // Afficher état APRÈS
    console.log('\n📊 ÉTAT APRÈS MIGRATION:\n');
    const after = await pool.query(`
      SELECT bonus_id, name, description
      FROM super_bonuses
      ORDER BY id
    `);
    console.table(after.rows);

    // Comparaison
    console.log('\n📈 RÉSUMÉ DES CHANGEMENTS:\n');
    for (let i = 0; i < before.rows.length; i++) {
      const beforeDesc = before.rows[i].description;
      const afterDesc = after.rows[i].description;

      if (beforeDesc !== afterDesc) {
        console.log(`✅ ${before.rows[i].name}:`);
        console.log(`   AVANT: "${beforeDesc}"`);
        console.log(`   APRÈS: "${afterDesc}"`);
        console.log('');
      }
    }

    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS !');

  } catch (error) {
    console.error('🔴 ERREUR lors de la migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigration();
