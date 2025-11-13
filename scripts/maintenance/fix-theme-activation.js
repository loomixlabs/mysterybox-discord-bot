const db = require('./utils/database-pg');

async function fixThemeActivation() {
  try {
    console.log('🔧 Correction de l\'activation du thème...\n');

    // Activer le thème en définissant activated_at à maintenant
    await db.query(`
      UPDATE themes
      SET activated_at = NOW()
      WHERE guild_id = '1248028543389143070'
        AND id = 23
        AND is_active = TRUE
        AND activated_at IS NULL
    `);

    console.log('✅ Thème activé avec activated_at = NOW()');

    // Vérifier le résultat
    const theme = await db.queryOne(`
      SELECT id, name, is_active, duration_days, activated_at,
             (activated_at + (duration_days || ' days')::INTERVAL) as expires_at
      FROM themes
      WHERE guild_id = '1248028543389143070'
        AND id = 23
    `);

    console.log('\n📋 Statut du thème après correction:');
    console.log(`   Nom: ${theme.name}`);
    console.log(`   Actif: ${theme.is_active}`);
    console.log(`   Durée: ${theme.duration_days} jours`);
    console.log(`   Activé le: ${theme.activated_at}`);
    console.log(`   Expire le: ${theme.expires_at}`);

    console.log('\n✅ Correction terminée !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixThemeActivation();
