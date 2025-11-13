const db = require('./utils/database-pg');

async function getThemeInfo() {
  try {
    console.log('🔍 Récupération des infos du thème Blanche-Neige...\n');

    // Infos du thème
    const theme = await db.queryOne(`
      SELECT name, required_items, final_role_name, duration_days
      FROM themes
      WHERE id = 23
    `);

    console.log('📋 THÈME:');
    console.log(`   Nom: ${theme.name}`);
    console.log(`   Items requis: ${theme.required_items}`);
    console.log(`   Rôle final: ${theme.final_role_name}`);
    console.log(`   Durée: ${theme.duration_days} jours\n`);

    // Nombre de collectibles
    const collectiblesCount = await db.queryOne(`
      SELECT COUNT(*) as total
      FROM collectibles
      WHERE theme_id = 23
    `);

    console.log(`📦 COLLECTIBLES: ${collectiblesCount.total} objets`);

    // Exemples de collectibles
    const collectibles = await db.queryAll(`
      SELECT name, description
      FROM collectibles
      WHERE theme_id = 23
      LIMIT 5
    `);

    collectibles.forEach(c => {
      console.log(`   - ${c.name}`);
    });

    console.log('\n✅ Informations récupérées !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

getThemeInfo();
