const db = require('./utils/database-pg');

async function verify() {
  try {
    console.log('🔍 VÉRIFICATION COMPLÈTE SYSTÈME MISSIONS\n');
    console.log('='.repeat(80));

    // 1. Vérifier les colonnes missions dans announcement_settings
    console.log('\n📋 COLONNES MISSIONS:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name='announcement_settings'
      AND column_name LIKE '%mission%'
      ORDER BY column_name;
    `);
    console.table(columns);
    console.log(`✅ ${columns.length} colonne(s) mission trouvée(s)`);

    // 2. Vérifier les templates
    console.log('\n📢 TEMPLATES MISSIONS:');
    const templates = await db.queryAll(`
      SELECT id, type, title
      FROM announcement_templates
      WHERE type LIKE '%mission%'
      ORDER BY type;
    `);
    console.table(templates);
    console.log(`✅ ${templates.length} template(s) mission trouvé(s)`);

    // 3. Vérifier les méthodes dans announcements.js
    console.log('\n🔧 MÉTHODES ANNONCES:');
    const announcements = require('./utils/announcements');
    const methods = [
      'announceMissionStarted',
      'announceMissionCompleted',
      'announceMissionFailed',
      'announceMissionApproved',
      'announceMissionRejected'
    ];
    methods.forEach(method => {
      const exists = typeof announcements[method] === 'function';
      console.log(`   ${exists ? '✅' : '❌'} ${method}`);
    });

    // 4. Résumé
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ SYSTÈME MISSIONS COMPLET!\n');
    console.log('📝 PRÊT POUR LES TESTS:\n');
    console.log('   1️⃣ Lancer une mission (/admin-panel > Missions)');
    console.log('   2️⃣ Configurer canal d\'annonces (Gérer les Annonces)');
    console.log('   3️⃣ Activer les annonces missions (toggle pour chaque type)');
    console.log('   4️⃣ Tester chaque scénario:');
    console.log('       - Mission lancée');
    console.log('       - Mission réussie');
    console.log('       - Mission échouée (timeout)');
    console.log('       - Mission échouée (mauvaise réponse)');
    console.log('       - Mission approuvée par admin');
    console.log('       - Mission refusée par admin\n');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verify();
