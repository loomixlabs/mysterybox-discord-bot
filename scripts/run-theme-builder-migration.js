/**
 * Script pour exécuter la migration Theme Builder
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: 'botuser',
  host: 'localhost',
  database: 'botdb',
  password: 'Discord2025IA@Bot',
  port: 5432
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('='.repeat(60));
    console.log('MIGRATION THEME BUILDER');
    console.log('='.repeat(60));

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'theme-builder-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('\n📄 Fichier SQL chargé');
    console.log('📊 Exécution de la migration...\n');

    // Exécuter la migration
    await client.query(sql);

    console.log('✅ Migration exécutée avec succès !\n');

    // Vérifier les tables créées
    console.log('🔍 Vérification des tables créées...\n');

    const tables = ['themes_library', 'theme_creator_guilds', 'theme_uploads', 'theme_builder_logs', 'banned_builder_users'];

    for (const table of tables) {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_name = $1
      `, [table]);

      const exists = result.rows[0].count > 0;
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    }

    // Vérifier colonne premium
    const premiumCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'guild_config'
      AND column_name IN ('is_premium', 'premium_expires_at')
    `);

    console.log(`\n  ✅ guild_config.is_premium: ${premiumCheck.rows.length > 0 ? 'Ajouté' : 'Erreur'}`);

    // Vérifier la vue
    const viewCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name = 'theme_builder_user_quotas'
    `);

    console.log(`  ✅ Vue theme_builder_user_quotas: ${viewCheck.rows[0].count > 0 ? 'Créée' : 'Erreur'}`);

    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION TERMINÉE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    console.error(error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
