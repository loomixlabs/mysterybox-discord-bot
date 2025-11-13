require('dotenv').config({ override: true });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'botdb',
  user: process.env.PGUSER || 'botuser',
  password: process.env.PGPASSWORD || 'Discord2025IA@Bot',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Début de la migration...');

    // Ajouter la colonne activated_at
    await client.query(`
      ALTER TABLE themes
      ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP DEFAULT NULL
    `);
    console.log('✅ Colonne activated_at ajoutée');

    // Mettre à jour les thèmes actifs avec la date de création
    const result = await client.query(`
      UPDATE themes
      SET activated_at = created_at
      WHERE is_active = TRUE AND activated_at IS NULL
    `);
    console.log(`✅ ${result.rowCount} thème(s) actif(s) mis à jour`);

    // Vérifier que la colonne existe
    const check = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'themes' AND column_name = 'activated_at'
    `);

    if (check.rows.length > 0) {
      console.log(`✅ Vérification OK: colonne ${check.rows[0].column_name} (${check.rows[0].data_type}) existe`);
    } else {
      console.log('❌ Erreur: colonne activated_at introuvable après création');
    }

    // Afficher tous les thèmes et leurs dates
    const themes = await client.query(`
      SELECT id, name, is_active, duration_days, created_at, activated_at
      FROM themes
      ORDER BY id
    `);

    console.log('\n📊 État des thèmes:');
    themes.rows.forEach(theme => {
      console.log(`  - ${theme.name} (ID: ${theme.id})`);
      console.log(`    Actif: ${theme.is_active ? '✅' : '❌'} | Durée: ${theme.duration_days}j`);
      console.log(`    Créé: ${theme.created_at}`);
      console.log(`    Activé: ${theme.activated_at || 'Jamais'}`);
    });

    console.log('\n🎉 Migration terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script échoué:', error);
    process.exit(1);
  });
