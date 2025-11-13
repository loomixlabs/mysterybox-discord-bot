const db = require('./utils/database-pg');
const { createDefaultTrapsForTheme } = require('./utils/trapDefaults');

async function createTraps() {
  try {
    console.log('🔍 Recherche du thème Blanche-Neige...\n');

    // Récupérer le thème Blanche-Neige
    const theme = await db.queryOne(`
      SELECT id, name, guild_id, theme_id
      FROM themes
      WHERE name LIKE '%Blanche%'
    `);

    if (!theme) {
      console.error('❌ Thème Blanche-Neige introuvable');
      process.exit(1);
    }

    console.log(`✅ Thème trouvé: ${theme.name}`);
    console.log(`   - ID: ${theme.id}`);
    console.log(`   - Theme ID: ${theme.theme_id}`);
    console.log(`   - Guild ID: ${theme.guild_id}\n`);

    // Créer les 4 pièges par défaut
    await createDefaultTrapsForTheme(theme.guild_id, theme.id);

    // Vérifier le résultat
    const trapsCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM traps
      WHERE guild_id = $1 AND theme_id = $2
    `, [theme.guild_id, theme.id]);

    console.log(`\n📊 Total de pièges créés: ${trapsCount.count}`);

    // Afficher les pièges créés
    const traps = await db.queryAll(`
      SELECT name, type, is_default, is_active
      FROM traps
      WHERE guild_id = $1 AND theme_id = $2
      ORDER BY type
    `, [theme.guild_id, theme.id]);

    console.log('\n📋 Liste des pièges:');
    traps.forEach(trap => {
      console.log(`   - ${trap.name} (${trap.type}) - Défaut: ${trap.is_default}, Actif: ${trap.is_active}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createTraps();
