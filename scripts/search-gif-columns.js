/**
 * Script pour rechercher les colonnes liées aux GIFs/images dans la DB
 */
require('dotenv').config();
const { Pool } = require('pg');

async function searchColumns() {
  const connectionString = process.env.DATABASE_URL;

  const pool = connectionString
    ? new Pool({ connectionString })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'botdb',
        user: process.env.DB_USER || 'botuser',
        password: process.env.DB_PASSWORD || 'Discord2025IA@Bot'
      });

  console.log('='.repeat(60));
  console.log('🔍 RECHERCHE COLONNES GIF/IMAGE/REVEAL/SECRET');
  console.log('='.repeat(60));

  try {
    // Chercher toutes les colonnes pertinentes
    const result = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND (
        column_name ILIKE '%gif%'
        OR column_name ILIKE '%reveal%'
        OR column_name ILIKE '%secret%'
        OR column_name ILIKE '%animation%'
        OR column_name ILIKE '%image%'
        OR column_name ILIKE '%thumbnail%'
      )
      ORDER BY table_name, column_name
    `);

    console.log('\n📋 COLONNES TROUVÉES:');
    result.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name}`));

    // Lister announcement_templates
    const templates = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'announcement_templates' ORDER BY ordinal_position`);
    console.log('\n📢 ANNOUNCEMENT_TEMPLATES:');
    templates.rows.forEach(r => console.log(`  - ${r.column_name}`));

    // Lister guild_config
    const guildConfig = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'guild_config' ORDER BY ordinal_position`);
    console.log('\n⚙️ GUILD_CONFIG:');
    guildConfig.rows.forEach(r => console.log(`  - ${r.column_name}`));

    // Lister themes
    const themes = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'themes' ORDER BY ordinal_position`);
    console.log('\n🎨 THEMES:');
    themes.rows.forEach(r => console.log(`  - ${r.column_name}`));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

searchColumns();
