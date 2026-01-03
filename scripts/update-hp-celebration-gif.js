/**
 * Script pour mettre à jour l'URL du GIF de célébration pour le thème HP
 */
require('dotenv').config();
const { Pool } = require('pg');

const HP_GUILD_ID = '1182395170273099806';
const HP_THEME_ID = 65;
const GIF_URL = 'http://72.60.185.62:8080/images/mysterybox-opening.gif';

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
  console.log('🎬 MISE À JOUR DU GIF DE CÉLÉBRATION HP');
  console.log('='.repeat(60));

  try {
    const result = await pool.query(
      `UPDATE theme_config
       SET mystery_box_celebration_gif = $1
       WHERE guild_id = $2 AND theme_id = $3
       RETURNING id, guild_id, theme_id, mystery_box_celebration_gif`,
      [GIF_URL, HP_GUILD_ID, HP_THEME_ID]
    );

    if (result.rows.length > 0) {
      console.log('\n✅ GIF URL mise à jour avec succès !');
      console.log(`📍 Guild ID: ${result.rows[0].guild_id}`);
      console.log(`📍 Theme ID: ${result.rows[0].theme_id}`);
      console.log(`🎬 GIF URL: ${result.rows[0].mystery_box_celebration_gif}`);
    } else {
      console.log('\n❌ Aucune ligne mise à jour - vérifier guild_id et theme_id');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

updateGif();
