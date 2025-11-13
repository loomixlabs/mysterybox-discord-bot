const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    user: process.env.DB_USER || 'botuser',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'botdb',
    password: process.env.DB_PASSWORD || 'Discord2025IA@Bot',
    port: process.env.DB_PORT || 5432,
  });

  console.log('🔧 MIGRATION: Correction de la contrainte UNIQUE sur missions\n');
  console.log('='.repeat(80));

  try {
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, 'database', 'migrations', 'fix-missions-unique-constraint.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('\n📋 Ancienne contrainte:');
    const oldConstraint = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'missions'
      AND conname = 'missions_guild_id_mission_id_key'
    `);
    console.table(oldConstraint.rows);

    console.log('\n⚙️  Exécution de la migration...\n');

    // Exécuter la migration
    await pool.query(sql);

    console.log('✅ Migration exécutée avec succès!\n');

    // Vérifier la nouvelle contrainte
    console.log('📋 Nouvelle contrainte:');
    const newConstraint = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'missions'
      AND conname = 'missions_guild_id_theme_id_mission_id_key'
    `);
    console.table(newConstraint.rows);

    console.log('\n✅ RÉSULTAT:');
    console.log('   Avant: UNIQUE (guild_id, mission_id)');
    console.log('   Après: UNIQUE (guild_id, theme_id, mission_id)');
    console.log('\n💡 Maintenant vous pouvez créer plusieurs thèmes avec les mêmes mission_ids!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
