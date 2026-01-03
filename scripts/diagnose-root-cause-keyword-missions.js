const db = require('../utils/database-pg');

async function diagnoseRootCause() {
  try {
    console.log('🔍 DIAGNOSTIC CAUSE RACINE - Missions Mot à Deviner Bloquées\n');
    console.log('='.repeat(80));

    const guildId = '1248028543389143070';

    // Récupérer la mission "Mot Deviné" (ID 12)
    const mission = await db.queryOne(`
      SELECT * FROM missions
      WHERE guild_id = $1
        AND type = 'keyword-message'
      LIMIT 1
    `, [guildId]);

    if (!mission) {
      console.log('❌ Aucune mission "keyword-message" trouvée');
      process.exit(1);
    }

    console.log('\n📝 MISSION TROUVÉE:\n');
    console.log(`  ID: ${mission.id}`);
    console.log(`  Nom: ${mission.name}`);
    console.log(`  Type: ${mission.type}`);
    console.log(`  Validation Type: ${mission.validation_type}`);
    console.log(`  Theme ID: ${mission.theme_id}`);
    console.log(`  Allowed Channels: ${mission.allowed_channels ? JSON.stringify(mission.allowed_channels) : 'NULL (tous les canaux)'}`);

    // CONDITION 1: Vérifier les mots-clés
    console.log('\n\n🔍 CONDITION 1: MOTS-CLÉS CONFIGURÉS\n');
    const keywords = await db.queryAll(`
      SELECT * FROM mission_keywords
      WHERE guild_id = $1
        AND mission_id = $2
    `, [guildId, mission.id]);

    console.log(`Nombre de mots-clés: ${keywords.length}`);

    if (keywords.length === 0) {
      console.log('❌ PROBLÈME TROUVÉ: Aucun mot-clé configuré !');
      console.log('   → validateKeywordMessage() retourne à la ligne 301-306');
      console.log('   → UPDATE de mission_progress JAMAIS EXÉCUTÉ');
      console.log('   → target_channel_id et target_keyword restent NULL');
    } else {
      console.log('✅ Mots-clés configurés correctement');
      console.table(keywords.map(k => ({
        id: k.id,
        keyword: k.keyword,
        difficulty: k.difficulty,
        target_channel_id: k.target_channel_id || 'NULL'
      })));
    }

    // CONDITION 2: Vérifier canaux disponibles
    console.log('\n\n🔍 CONDITION 2: CANAUX DISPONIBLES\n');

    if (mission.allowed_channels && mission.allowed_channels.length > 0) {
      console.log(`Mission restreinte à ${mission.allowed_channels.length} canaux:`);
      console.log(mission.allowed_channels);
    } else {
      console.log('Mission sans restriction de canaux (tous les canaux texte autorisés)');
    }

    console.log('\n💡 NOTES:');
    console.log('   - Si allowed_channels est vide/NULL → Utilise tous les canaux visibles par le bot');
    console.log('   - Si aucun canal disponible → handleManualValidation() appelé (ligne 334)');
    console.log('   - Mais handleManualValidation() ne met PAS à jour target_channel_id/target_keyword');

    // SOLUTION
    console.log('\n\n✅ SOLUTION:\n');
    console.log('1. Si aucun mot-clé configuré:');
    console.log('   → Ajouter des mots-clés via Admin Panel');
    console.log('   → OU mettre à jour validateKeywordMessage() pour fallback');
    console.log('');
    console.log('2. Si aucun canal disponible:');
    console.log('   → Vérifier permissions du bot sur les canaux');
    console.log('   → Vérifier allowed_channels de la mission');
    console.log('');
    console.log('3. FIX PRÉVENTIF (recommandé):');
    console.log('   → Modifier validateKeywordMessage() pour TOUJOURS faire l\'UPDATE');
    console.log('   → Même en cas d\'erreur, stocker NULL de manière explicite');
    console.log('   → Ou faire l\'UPDATE AVANT les validations');

    // Statistiques finales
    console.log('\n\n📊 STATISTIQUES ACTUELLES:\n');
    const stats = await db.queryOne(`
      SELECT
        COUNT(*) FILTER (WHERE target_channel_id IS NOT NULL AND target_keyword IS NOT NULL) as success_count,
        COUNT(*) FILTER (WHERE target_channel_id IS NULL OR target_keyword IS NULL) as failed_count,
        COUNT(*) as total_count
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1
        AND m.type = 'keyword-message'
    `, [guildId]);

    console.log(`Total missions "Mot à Deviner": ${stats.total_count}`);
    console.log(`Missions avec champs correctement remplis: ${stats.success_count} (${((stats.success_count / stats.total_count) * 100).toFixed(2)}%)`);
    console.log(`Missions avec NULL (bloquées): ${stats.failed_count} (${((stats.failed_count / stats.total_count) * 100).toFixed(2)}%)`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnostic terminé\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

diagnoseRootCause();
