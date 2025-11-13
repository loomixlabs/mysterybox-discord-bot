const db = require('./utils/database-pg');

async function checkThemeStatus() {
  try {
    console.log('🔍 Vérification du statut du thème...\n');

    const themes = await db.queryAll(`
      SELECT id, name, is_active, duration_days, is_expired, created_at
      FROM themes
      WHERE guild_id = '1248028543389143070'
      ORDER BY id
    `);

    if (themes.length === 0) {
      console.log('❌ Aucun thème trouvé');
      process.exit(1);
    }

    themes.forEach(theme => {
      console.log(`📋 Thème ${theme.id}: ${theme.name}`);
      console.log(`   ✅ Actif: ${theme.is_active}`);
      console.log(`   ⏰ Durée (jours): ${theme.duration_days || 'Illimité'}`);
      console.log(`   📅 Créé le: ${theme.created_at}`);
      console.log(`   ❌ Expiré: ${theme.is_expired}\n`);
    });

    console.log('✅ Vérification terminée !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkThemeStatus();
