/**
 * Script pour vérifier les messages et templates du thème HP
 */
require('dotenv').config();
const { Pool } = require('pg');

const HP_GUILD_ID = '1182395170273099806';
const HP_THEME_ID = 65;

async function check() {
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
  console.log('🔍 VÉRIFICATION THÈME HP - MESSAGES & TEMPLATES');
  console.log('='.repeat(60));

  try {
    // Vérifier theme_messages
    const messages = await pool.query(
      'SELECT key, content FROM theme_messages WHERE guild_id = $1 AND theme_id = $2',
      [HP_GUILD_ID, HP_THEME_ID]
    );
    console.log('\n📝 THEME_MESSAGES (HP):');
    if (messages.rows.length === 0) {
      console.log('  (aucune entrée)');
    } else {
      messages.rows.forEach(r => {
        const preview = r.content ? r.content.substring(0, 60) + '...' : 'NULL';
        console.log(`  ${r.key}: ${preview}`);
      });
    }

    // Vérifier announcement_templates
    const templates = await pool.query(
      'SELECT type, image_url, thumbnail_url FROM announcement_templates WHERE guild_id = $1 AND theme_id = $2',
      [HP_GUILD_ID, HP_THEME_ID]
    );
    console.log('\n📢 ANNOUNCEMENT_TEMPLATES (HP):');
    if (templates.rows.length === 0) {
      console.log('  (aucune entrée)');
    } else {
      templates.rows.forEach(r => {
        console.log(`  ${r.type}:`);
        console.log(`    image_url: ${r.image_url || 'NULL'}`);
        console.log(`    thumbnail_url: ${r.thumbnail_url || 'NULL'}`);
      });
    }

    // Lister tous les types d'announcement_templates disponibles (sans filtre theme)
    const allTypes = await pool.query(
      'SELECT DISTINCT type FROM announcement_templates WHERE guild_id = $1 ORDER BY type',
      [HP_GUILD_ID]
    );
    console.log('\n📋 TOUS LES TYPES DE TEMPLATES (guild HP):');
    allTypes.rows.forEach(r => console.log(`  - ${r.type}`));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

check();
