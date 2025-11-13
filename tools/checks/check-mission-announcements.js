const db = require('./utils/database-pg');

/**
 * Vérifier l'intégration du système d'annonces pour les missions
 */

async function checkMissionAnnouncements() {
  try {
    console.log('🔍 VÉRIFICATION SYSTÈME D\'ANNONCES MISSIONS\n');
    console.log('='.repeat(80));

    // 1. Vérifier les colonnes announcement_settings pour missions
    console.log('\n📋 COLONNES MISSIONS dans announcement_settings:');
    const settingsColumns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name='announcement_settings'
      AND column_name LIKE '%mission%'
      ORDER BY column_name;
    `);

    if (settingsColumns && settingsColumns.length > 0) {
      console.table(settingsColumns);
      console.log(`\n   ✅ ${settingsColumns.length} colonne(s) mission trouvée(s)`);
    } else {
      console.log('   ❌ Aucune colonne mission trouvée !');
    }

    // 2. Vérifier les templates d'annonces pour missions
    console.log('\n\n📢 TEMPLATES D\'ANNONCES MISSIONS:');
    const templates = await db.queryAll(`
      SELECT id, guild_id, type, title, description
      FROM announcement_templates
      WHERE type LIKE '%mission%'
      ORDER BY type;
    `);

    if (templates && templates.length > 0) {
      console.table(templates);
      console.log(`\n   ✅ ${templates.length} template(s) mission trouvé(s)`);
    } else {
      console.log('   ❌ Aucun template mission trouvé !');
    }

    // 3. Lister les types d'annonces recommandés
    console.log('\n\n🎯 TYPES D\'ANNONCES RECOMMANDÉS:');
    const recommendedTypes = [
      { type: 'mission_word_guessed', status: '✅ EXISTANT', description: 'Mot-clé deviné dans mission keyword-message' },
      { type: 'mission_started', status: '❌ MANQUANT', description: 'Joueur lance une mission' },
      { type: 'mission_completed', status: '❌ MANQUANT', description: 'Mission terminée avec succès' },
      { type: 'mission_failed', status: '❌ MANQUANT', description: 'Mission échouée (timeout ou erreur)' },
      { type: 'mission_approved', status: '❌ MANQUANT', description: 'Admin valide une mission manuelle' },
      { type: 'mission_rejected', status: '❌ MANQUANT', description: 'Admin refuse une mission manuelle' }
    ];

    console.table(recommendedTypes);

    // 4. Résumé
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RÉSUMÉ:\n');

    const existingTypes = templates.map(t => t.type);
    const missingTypes = recommendedTypes
      .filter(r => r.status.includes('MANQUANT'))
      .map(r => r.type);

    console.log(`   Templates existants: ${existingTypes.length}`);
    if (existingTypes.length > 0) {
      existingTypes.forEach(t => console.log(`      - ${t}`));
    }

    console.log(`\n   Templates manquants: ${missingTypes.length}`);
    if (missingTypes.length > 0) {
      missingTypes.forEach(t => console.log(`      - ${t}`));
    }

    console.log(`\n   Colonnes settings: ${settingsColumns.length}`);

    if (missingTypes.length > 0) {
      console.log('\n   ⚠️ ACTION REQUISE:');
      console.log('   1. Ajouter les colonnes manquantes dans announcement_settings');
      console.log('   2. Créer les templates d\'annonces manquants');
      console.log('   3. Implémenter les méthodes dans utils/announcements.js');
      console.log('   4. Ajouter les appels dans handlers/missionHandler.js');
    } else {
      console.log('\n   ✅ Système d\'annonces complet !');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Vérification terminée\n');

    process.exit(missingTypes.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

checkMissionAnnouncements();
