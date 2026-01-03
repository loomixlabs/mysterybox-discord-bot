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

/**
 * Exécute la migration du système de login tracking
 * Sprint 3: Badges Engagement
 */

async function runMigration() {
  console.log('\n🚀 MIGRATION: Système de Login Tracking\n');
  console.log('═'.repeat(100));

  try {
    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-login-tracking-system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📂 Fichier de migration:', sqlPath);
    console.log('📏 Taille:', sql.length, 'caractères\n');

    // Exécuter la migration
    console.log('⏳ Exécution de la migration...\n');

    await pool.query(sql);

    console.log('✅ Migration exécutée avec succès\n');

    // Vérifier les tables créées
    console.log('🔍 Vérification des tables...\n');

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('player_login_history')
      ORDER BY table_name
    `);

    console.log(`✅ ${tables.rows.length} table(s) créée(s):`);
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Vérifier les colonnes ajoutées à players
    console.log('\n🔍 Vérification des colonnes players...\n');

    const columns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'players'
        AND column_name IN ('current_login_streak', 'last_login_date', 'best_login_streak')
      ORDER BY column_name
    `);

    console.log(`✅ ${columns.rows.length} colonne(s) ajoutée(s) à players:`);
    columns.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type}, default: ${row.column_default || 'NULL'})`);
    });

    // Vérifier les index
    console.log('\n🔍 Vérification des index...\n');

    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname LIKE 'idx_login_history%'
          OR indexname = 'idx_players_login_streak'
        )
      ORDER BY indexname
    `);

    console.log(`✅ ${indexes.rows.length} index créé(s):`);
    indexes.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });

    console.log('\n' + '═'.repeat(100));
    console.log('\n🎉 MIGRATION TERMINÉE AVEC SUCCÈS\n');
    console.log('📋 Prochaines étapes:');
    console.log('   1. Implémenter logique de tracking dans database-pg.js');
    console.log('   2. Ajouter détection de connexion dans interactionCreate.js');
    console.log('   3. Tester calcul de streaks');
    console.log('   4. Valider déblocage badges Engagement\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    console.error('\n📋 Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
