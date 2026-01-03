/**
 * Script pour mettre à jour le GIF de mission révélée pour le thème HP
 */
require('dotenv').config();
const { Pool } = require('pg');

const HP_GUILD_ID = '1182395170273099806';
const HP_THEME_ID = 65;
const GIF_URL = 'http://72.60.185.62:8080/images/secret-mission-reveal.gif';

async function updateGif() {
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
  console.log('🎬 MISE À JOUR DU GIF MISSION RÉVÉLÉE HP');
  console.log('='.repeat(60));

  try {
    const result = await pool.query(
      `INSERT INTO theme_messages (guild_id, theme_id, key, content)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id, theme_id, key) DO UPDATE SET content = $4
       RETURNING *`,
      [HP_GUILD_ID, HP_THEME_ID, 'mission_revealed_gif', GIF_URL]
    );

    if (result.rows.length > 0) {
      console.log('\n✅ mission_revealed_gif mis à jour avec succès !');
      console.log(`📍 Guild ID: ${result.rows[0].guild_id}`);
      console.log(`📍 Theme ID: ${result.rows[0].theme_id}`);
      console.log(`🔑 Key: ${result.rows[0].key}`);
      console.log(`🎬 GIF URL: ${result.rows[0].content}`);
    } else {
      console.log('\n❌ Aucune ligne insérée/mise à jour');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

updateGif();
