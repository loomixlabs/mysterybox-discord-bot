/**
 * Vérifier l'état de guild_config et les contraintes de announcement_templates
 */

const db = require('../utils/database-pg');

const TEST_GUILD_ID = '1377376612034695270';

async function check() {
  try {
    console.log('🔍 DIAGNOSTIC GUILD_CONFIG ET ANNOUNCEMENT_TEMPLATES\n');
    console.log('='.repeat(80));

    // 1. Vérifier si guild_config existe pour ce serveur
    console.log('\n📋 1. GUILD_CONFIG:\n');
    const guildConfig = await db.queryOne(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [TEST_GUILD_ID]
    );

    if (guildConfig) {
      console.log('   ✅ guild_config EXISTE');
      console.table([guildConfig]);
    } else {
      console.log('   ❌ guild_config N\'EXISTE PAS - C\'est le problème!');
    }

    // 2. Vérifier les contraintes FK de announcement_templates
    console.log('\n📋 2. CONTRAINTES FK DE announcement_templates:\n');
    const fks = await db.queryAll(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'announcement_templates'
        AND tc.constraint_type = 'FOREIGN KEY'
    `);

    if (fks.length > 0) {
      console.log('   FKs trouvées:');
      console.table(fks);
    } else {
      console.log('   ✅ Aucune FK trouvée - On peut insérer sans guild_config!');
    }

    // 3. Tester l'insertion directe
    console.log('\n📋 3. TEST INSERTION DIRECTE:\n');
    try {
      await db.query(`
        INSERT INTO announcement_templates (guild_id, type, title, description, color)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id, type) DO NOTHING
      `, [TEST_GUILD_ID, 'test_type', 'Test Title', 'Test Description', '#FF0000']);
      console.log('   ✅ Insertion réussie sans guild_config!');

      // Supprimer le test
      await db.query(
        'DELETE FROM announcement_templates WHERE guild_id = $1 AND type = $2',
        [TEST_GUILD_ID, 'test_type']
      );
      console.log('   ✅ Test supprimé');
    } catch (err) {
      console.log('   ❌ Erreur insertion:', err.message);
    }

    // 4. Compter les templates existants pour tous les serveurs
    console.log('\n📋 4. TEMPLATES PAR SERVEUR:\n');
    const templatesCount = await db.queryAll(`
      SELECT guild_id, COUNT(*) as count
      FROM announcement_templates
      GROUP BY guild_id
    `);

    if (templatesCount.length > 0) {
      console.table(templatesCount);
    } else {
      console.log('   ❌ Aucun template dans toute la base!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
