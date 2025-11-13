const db = require('./utils/database-pg');

async function checkActiveTheme() {
  try {
    const guildId = '297309737135898624';

    console.log('🔍 Vérification du thème actif...\n');

    // Vérifier le thème actif
    const activeTheme = await db.getActiveTheme(guildId);

    if (!activeTheme) {
      console.log('❌ Aucun thème actif trouvé!\n');
      console.log('💡 Astuce: Un thème doit être actif pour afficher les missions.\n');
    } else {
      console.log('✅ Thème actif trouvé:');
      console.log(`   ID: ${activeTheme.id}`);
      console.log(`   Nom: ${activeTheme.name}`);
      console.log(`   Actif: ${activeTheme.is_active}\n`);
    }

    // Lister tous les thèmes
    console.log('📋 Tous les thèmes:');
    const allThemes = await db.queryAll(`
      SELECT id, guild_id, name, is_active, created_at
      FROM themes
      WHERE guild_id = $1
      ORDER BY id
    `, [guildId]);

    if (allThemes.length === 0) {
      console.log('   ❌ Aucun thème trouvé\n');
    } else {
      allThemes.forEach(t => {
        console.log(`   ${t.is_active ? '✅' : '⚪'} Thème #${t.id}: ${t.name} (actif: ${t.is_active})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkActiveTheme();
