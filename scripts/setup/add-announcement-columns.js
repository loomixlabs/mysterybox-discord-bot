require('dotenv').config({ override: true });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'botdb',
  user: process.env.PGUSER || 'botuser',
  password: process.env.PGPASSWORD || 'Discord2025IA@Bot',
});

async function addColumns() {
  const client = await pool.connect();
  try {
    console.log('\n=== AJOUT DES COLONNES D\'ANNONCES DE THÈME ===\n');

    // Ajouter les colonnes
    await client.query(`
      ALTER TABLE announcement_settings
      ADD COLUMN IF NOT EXISTS theme_expired BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS theme_expiring_soon BOOLEAN DEFAULT FALSE
    `);

    console.log('✅ Colonnes ajoutées avec succès !');

    // Vérifier
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      AND column_name IN ('theme_expired', 'theme_expiring_soon')
    `);

    console.log('\n📊 Colonnes créées:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

addColumns()
  .then(() => {
    console.log('\n✅ Migration terminée');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
