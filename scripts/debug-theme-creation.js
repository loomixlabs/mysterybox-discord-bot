const db = require('../utils/database-pg');

async function debug() {
  try {
    console.log('🔍 DEBUG - Recherche thème "test"\n');
    console.log('='.repeat(80));

    // Recherche du thème test
    console.log('\n📊 Recherche theme "test":');
    const testThemes = await db.queryAll(`
      SELECT * FROM themes WHERE theme_id ILIKE '%test%' OR name ILIKE '%test%'
    `);
    if (testThemes.length > 0) {
      console.table(testThemes);
    } else {
      console.log('❌ Aucun thème "test" trouvé');
    }

    // Audit logs récents pour les thèmes
    console.log('\n📊 Audit logs récents (theme):');
    const auditLogs = await db.queryAll(`
      SELECT action, entity_type, details, created_at
      FROM audit_logs
      WHERE entity_type = 'theme'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    if (auditLogs.length > 0) {
      console.table(auditLogs.map(log => ({
        action: log.action,
        entity: log.entity_type,
        details: JSON.stringify(log.details).substring(0, 80),
        created: log.created_at
      })));
    } else {
      console.log('Aucun audit log pour les thèmes');
    }

    // IDs des thèmes les plus récents (pour voir les gaps)
    console.log('\n📊 IDs des thèmes (pour détecter les suppressions):');
    const allIds = await db.queryAll(`SELECT id, theme_id, name FROM themes ORDER BY id`);
    console.table(allIds);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

debug();
