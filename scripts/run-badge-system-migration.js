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

async function runMigration() {
  console.log('🔄 MIGRATION: Système de Badges\n');
  console.log('═'.repeat(100));

  try {
    // Lire le fichier SQL
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add-badge-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Fichier de migration:', migrationPath);
    console.log('📦 Taille du fichier:', migrationSQL.length, 'caractères\n');

    // Exécuter la migration
    console.log('⏳ Exécution de la migration...\n');

    await pool.query(migrationSQL);

    console.log('✅ Migration exécutée avec succès!\n');

    // Vérifier la création des tables
    console.log('🔍 Vérification des tables créées:\n');
    console.log('─'.repeat(100));

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('badges', 'player_badges', 'badge_progress')
      ORDER BY table_name
    `);

    console.log('Tables créées:');
    tables.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Afficher la structure de chaque table
    for (const table of tables.rows) {
      console.log(`\n📊 Structure de ${table.table_name}:`);
      console.log('─'.repeat(100));

      const columns = await pool.query(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table.table_name]);

      console.table(columns.rows);
    }

    // Vérifier les contraintes CHECK
    console.log('\n🔒 Contraintes CHECK:');
    console.log('─'.repeat(100));

    const checkConstraints = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name IN ('badges', 'player_badges', 'badge_progress')
      ORDER BY tc.table_name, tc.constraint_name
    `);

    console.table(checkConstraints.rows);

    // Vérifier les index
    console.log('\n📇 Index créés:');
    console.log('─'.repeat(100));

    const indexes = await pool.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('badges', 'player_badges', 'badge_progress')
      ORDER BY tablename, indexname
    `);

    console.table(indexes.rows.map(row => ({
      table: row.tablename,
      index: row.indexname,
      definition: row.indexdef.substring(0, 80) + '...'
    })));

    // Vérifier les triggers
    console.log('\n⚡ Triggers créés:');
    console.log('─'.repeat(100));

    const triggers = await pool.query(`
      SELECT
        trigger_name,
        event_manipulation,
        event_object_table,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_table IN ('badges', 'player_badges', 'badge_progress')
      ORDER BY event_object_table, trigger_name
    `);

    if (triggers.rows.length > 0) {
      console.table(triggers.rows);
    } else {
      console.log('  ℹ️  Aucun trigger trouvé (normal pour badges et player_badges)');
    }

    console.log('\n' + '═'.repeat(100));
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS\n');
    console.log('📋 Prochaines étapes:');
    console.log('  1. Implémenter les méthodes database wrapper');
    console.log('  2. Créer le handler badgeHandler.js');
    console.log('  3. Seed les badges Super Bonus\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    console.error('\n📋 Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
