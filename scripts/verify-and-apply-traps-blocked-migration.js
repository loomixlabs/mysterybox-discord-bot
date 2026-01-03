const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function verifyAndApplyMigration() {
  try {
    console.log('🛡️ VÉRIFICATION & APPLICATION: Migration traps_blocked\n');
    console.log('='.repeat(80));

    // 1. Vérifier si la colonne existe déjà
    console.log('\n🔍 Étape 1: Vérification de l\'existence de la colonne...');
    const checkColumn = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'players' AND column_name = 'traps_blocked'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ La colonne traps_blocked existe déjà!');
      console.table(checkColumn.rows);

      // Afficher les statistiques
      console.log('\n📊 Statistiques actuelles:');
      const stats = await pool.query(`
        SELECT
          COUNT(*) as total_players,
          COUNT(CASE WHEN traps_blocked > 0 THEN 1 END) as players_with_blocks,
          COALESCE(MAX(traps_blocked), 0) as max_blocked
        FROM players
      `);
      console.table(stats.rows);

      console.log('\n✅ Migration déjà appliquée - Rien à faire!');
      process.exit(0);
    }

    console.log('⚠️  La colonne traps_blocked n\'existe pas encore');

    // 2. Lire le fichier de migration
    console.log('\n📄 Étape 2: Lecture du fichier SQL de migration...');
    const migrationPath = path.join(__dirname, '../database/migrations/add-traps-blocked-tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Fichier SQL chargé');
    console.log('\nSQL à exécuter:');
    console.log('-'.repeat(80));
    console.log(migrationSQL);
    console.log('-'.repeat(80));

    // 3. Exécuter la migration
    console.log('\n🔄 Étape 3: Exécution de la migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration exécutée avec succès!');

    // 4. Vérifier que la colonne a été créée
    console.log('\n🔍 Étape 4: Vérification post-migration...');
    const verify = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'players' AND column_name = 'traps_blocked'
    `);

    if (verify.rows.length > 0) {
      console.log('✅ Colonne traps_blocked créée avec succès!');
      console.table(verify.rows);
    } else {
      console.log('❌ ERREUR: Colonne traps_blocked non trouvée après migration');
      process.exit(1);
    }

    // 5. Vérifier l'index
    console.log('\n🔍 Étape 5: Vérification de l\'index...');
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'players' AND indexname = 'idx_players_traps_blocked'
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ Index idx_players_traps_blocked créé!');
      console.table(indexCheck.rows);
    } else {
      console.log('⚠️  Index non trouvé (peut-être conditionnel)');
    }

    // 6. Statistiques finales
    console.log('\n📊 Étape 6: Statistiques des joueurs...');
    const finalStats = await pool.query(`
      SELECT
        COUNT(*) as total_players,
        COUNT(CASE WHEN traps_blocked > 0 THEN 1 END) as players_with_blocks,
        COALESCE(MAX(traps_blocked), 0) as max_blocked
      FROM players
    `);
    console.table(finalStats.rows);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Migration terminée avec succès!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyAndApplyMigration();
