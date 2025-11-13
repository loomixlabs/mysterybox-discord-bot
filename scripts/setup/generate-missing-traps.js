const db = require('./utils/database-pg');
const { ensureAllDefaultTraps } = require('./utils/trapDefaults');

async function generateMissingTraps() {
  console.log('\n🔧 GÉNÉRATION DES PIÈGES MANQUANTS\n');
  console.log('='.repeat(80));

  try {
    // Récupérer tous les thèmes actifs
    const themes = await db.queryAll(`
      SELECT guild_id, id, name
      FROM themes
      WHERE is_active = TRUE
      ORDER BY guild_id, id
    `);

    if (themes.length === 0) {
      console.log('⚠️  Aucun thème actif trouvé');
      process.exit(0);
    }

    console.log(`\n📋 ${themes.length} thème(s) actif(s) trouvé(s):`);
    console.table(themes);

    // Pour chaque thème, vérifier et créer les pièges manquants
    for (const theme of themes) {
      console.log(`\n\n${'='.repeat(80)}`);
      console.log(`🎯 Traitement du thème "${theme.name}" (ID: ${theme.id}, Serveur: ${theme.guild_id})`);
      console.log('='.repeat(80));

      // Afficher les pièges existants
      const existingTraps = await db.queryAll(
        `SELECT trap_id, name, type, is_default, is_active
         FROM traps
         WHERE guild_id = $1 AND theme_id = $2
         ORDER BY type`,
        [theme.guild_id, theme.id]
      );

      console.log(`\n📊 Pièges existants (${existingTraps.length}):`);
      if (existingTraps.length > 0) {
        console.table(existingTraps);
      } else {
        console.log('⚠️  Aucun piège existant');
      }

      // Créer les pièges manquants
      await ensureAllDefaultTraps(theme.guild_id, theme.id);

      // Afficher les pièges après création
      const updatedTraps = await db.queryAll(
        `SELECT trap_id, name, type, is_default, is_active
         FROM traps
         WHERE guild_id = $1 AND theme_id = $2
         ORDER BY type`,
        [theme.guild_id, theme.id]
      );

      console.log(`\n✅ Pièges après traitement (${updatedTraps.length}):`);
      console.table(updatedTraps);
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ GÉNÉRATION TERMINÉE !');
    console.log('='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de la génération:', error);
    process.exit(1);
  }
}

generateMissingTraps();
