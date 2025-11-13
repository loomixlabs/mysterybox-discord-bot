require('dotenv').config({ override: true });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'botdb',
  user: process.env.PGUSER || 'botuser',
  password: process.env.PGPASSWORD || 'Discord2025IA@Bot',
});

async function checkDatabase() {
  const client = await pool.connect();
  try {
    console.log('\n=== VERIFICATION DU THEME BLANCHE-NEIGE ===\n');

    // 1. Récupérer le thème
    const themeResult = await client.query(
      `SELECT id, theme_id, guild_id, name, is_active, required_items
       FROM themes
       WHERE name LIKE '%Blanche%'`
    );

    console.log('📊 Thèmes trouvés:', themeResult.rows.length);
    themeResult.rows.forEach(theme => {
      console.log(`  - ID: ${theme.id}, Theme_ID: ${theme.theme_id}, Guild: ${theme.guild_id}`);
      console.log(`    Nom: ${theme.name}`);
      console.log(`    Actif: ${theme.is_active}, Items requis: ${theme.required_items}`);
    });

    if (themeResult.rows.length === 0) {
      console.log('❌ Aucun thème trouvé !');
      return;
    }

    const theme = themeResult.rows[0];

    // 2. Récupérer les collectibles pour ce thème
    console.log(`\n=== COLLECTIBLES POUR LE THEME ID=${theme.id} ===\n`);

    const collectiblesResult = await client.query(
      `SELECT id, collectible_id, theme_id, name, rarity, image_url
       FROM collectibles
       WHERE theme_id = $1`,
      [theme.id]
    );

    console.log(`📦 Collectibles trouvés: ${collectiblesResult.rows.length}`);
    collectiblesResult.rows.forEach(c => {
      console.log(`  - ID: ${c.id}, Collectible_ID: ${c.collectible_id}`);
      console.log(`    Nom: ${c.name}, Rareté: ${c.rarity}`);
      console.log(`    Theme_ID: ${c.theme_id}`);
    });

    // 3. Vérifier avec le theme_id au lieu de l'id
    console.log(`\n=== TEST AVEC THEME_ID="${theme.theme_id}" ===\n`);

    const collectiblesResult2 = await client.query(
      `SELECT id, collectible_id, theme_id, name, rarity
       FROM collectibles
       WHERE theme_id = $1`,
      [theme.theme_id]
    );

    console.log(`📦 Collectibles avec theme_id string: ${collectiblesResult2.rows.length}`);
    collectiblesResult2.rows.forEach(c => {
      console.log(`  - ${c.name} (${c.rarity})`);
    });

    // 4. Voir tous les collectibles
    console.log(`\n=== TOUS LES COLLECTIBLES ===\n`);

    const allCollectibles = await client.query(
      `SELECT id, collectible_id, theme_id, name, rarity
       FROM collectibles
       ORDER BY id DESC
       LIMIT 10`
    );

    console.log(`📦 Total collectibles (10 derniers): ${allCollectibles.rows.length}`);
    allCollectibles.rows.forEach(c => {
      console.log(`  - ID: ${c.id}, Theme_ID: ${c.theme_id}, Nom: ${c.name}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabase()
  .then(() => {
    console.log('\n✅ Vérification terminée');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
