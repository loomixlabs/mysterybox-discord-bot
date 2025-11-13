const db = require('./utils/database-pg');

async function analyzeMissionsSystem() {
  try {
    console.log('🔍 ANALYSE COMPLÈTE DU SYSTÈME DE MISSIONS\n');
    console.log('='.repeat(80));

    // 1. Structure des tables missions
    console.log('\n📋 TABLES MISSIONS:');
    console.log('-'.repeat(80));

    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%mission%'
      ORDER BY table_name;
    `);

    console.table(tables);

    // 2. Structure détaillée de chaque table
    for (const table of tables) {
      console.log(`\n📊 Structure de ${table.table_name}:`);
      console.log('-'.repeat(80));

      const columns = await db.queryAll(`
        SELECT
          column_name,
          data_type,
          column_default,
          is_nullable,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_name='${table.table_name}'
        ORDER BY ordinal_position;
      `);

      console.table(columns);

      // Vérifier si guild_id existe
      const hasGuildId = columns.find(col => col.column_name === 'guild_id');
      if (hasGuildId) {
        console.log('✅ guild_id présent (compatible multi-serveur)');
      } else {
        console.log('❌ guild_id MANQUANT (non compatible multi-serveur)');
      }
    }

    // 3. Données existantes (exemples)
    console.log('\n📦 DONNÉES EXISTANTES:');
    console.log('-'.repeat(80));

    try {
      const missions = await db.queryAll(`
        SELECT * FROM missions LIMIT 3;
      `);

      if (missions && missions.length > 0) {
        console.log('\n✅ Missions existantes:');
        console.table(missions);
      } else {
        console.log('\n⚠️ Aucune mission en base');
      }
    } catch (error) {
      console.log('\n❌ Table missions introuvable:', error.message);
    }

    // 4. Vérifier l'intégration avec announcements
    console.log('\n📢 INTÉGRATION SYSTÈME D\'ANNONCES:');
    console.log('-'.repeat(80));

    try {
      const announcementTemplates = await db.queryAll(`
        SELECT announcement_type, title
        FROM announcement_templates
        WHERE announcement_type LIKE '%mission%'
        LIMIT 5;
      `);

      if (announcementTemplates && announcementTemplates.length > 0) {
        console.log('\n✅ Templates d\'annonces missions:');
        console.table(announcementTemplates);
      } else {
        console.log('\n⚠️ Aucun template d\'annonce pour les missions');
      }
    } catch (error) {
      console.log('\n❌ Erreur lors de la vérification des annonces:', error.message);
    }

    // 5. Vérifier les settings d'annonces
    try {
      const announcementSettings = await db.queryAll(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name='announcement_settings'
        AND column_name LIKE '%mission%'
        ORDER BY column_name;
      `);

      if (announcementSettings && announcementSettings.length > 0) {
        console.log('\n✅ Colonnes missions dans announcement_settings:');
        console.table(announcementSettings);
      } else {
        console.log('\n⚠️ Aucune colonne mission dans announcement_settings');
      }
    } catch (error) {
      console.log('\n❌ Erreur:', error.message);
    }

    // 6. Contraintes et index
    console.log('\n🔗 CONTRAINTES ET INDEX:');
    console.log('-'.repeat(80));

    try {
      const constraints = await db.queryAll(`
        SELECT
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name LIKE '%mission%'
        ORDER BY tc.table_name, tc.constraint_type;
      `);

      console.table(constraints);
    } catch (error) {
      console.log('❌ Erreur:', error.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analyse terminée');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeMissionsSystem();
