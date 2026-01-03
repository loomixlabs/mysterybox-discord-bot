const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function checkPlayersConstraints() {
  console.log('\n🔍 VÉRIFICATION: Contraintes table players\n');
  console.log('═'.repeat(100));

  try {
    // Structure de la table
    console.log('\n📋 Colonnes de la table players:\n');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'players'
      ORDER BY ordinal_position
    `);
    console.table(columns.rows);

    // Primary key
    console.log('\n🔑 Primary Key:\n');
    const pk = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'players'::regclass
        AND contype = 'p'
    `);
    console.table(pk.rows);

    // Contraintes UNIQUE
    console.log('\n✨ Contraintes UNIQUE:\n');
    const unique = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'players'::regclass
        AND contype = 'u'
    `);

    if (unique.rows.length > 0) {
      console.table(unique.rows);
    } else {
      console.log('   ⚠️  Aucune contrainte UNIQUE trouvée');
    }

    // Foreign keys sur players
    console.log('\n🔗 Foreign Keys (outbound):\n');
    const fk = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'players'::regclass
        AND contype = 'f'
    `);

    if (fk.rows.length > 0) {
      console.table(fk.rows);
    } else {
      console.log('   ℹ️  Aucune foreign key sortante');
    }

    // Index sur players
    console.log('\n📊 Index:\n');
    const indexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'players'
      ORDER BY indexname
    `);
    console.table(indexes.rows);

    console.log('\n' + '═'.repeat(100));
    console.log('\n✅ VÉRIFICATION TERMINÉE\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error('\n📋 Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkPlayersConstraints();
