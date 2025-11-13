const db = require('./utils/database-pg');

async function verifyAuditLogs() {
  console.log('🔍 VÉRIFICATION DE LA TABLE AUDIT_LOGS\n');
  console.log('='.repeat(80));

  // Vérifier la structure de la table
  console.log('\n📋 STRUCTURE DE LA TABLE:\n');
  const columns = await db.queryAll(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    ORDER BY ordinal_position
  `);
  console.table(columns);

  // Compter les entrées
  const count = await db.queryOne('SELECT COUNT(*) as count FROM audit_logs');
  console.log(`\n✅ Total d'entrées dans audit_logs: ${count.count}`);

  // Si des entrées existent, afficher les dernières
  if (count.count > 0) {
    console.log('\n📝 LES 10 DERNIÈRES ENTRÉES:\n');
    const logs = await db.queryAll(`
      SELECT
        id,
        guild_id,
        admin_id,
        action,
        details,
        created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.table(logs.map(log => ({
      id: log.id,
      guild_id: log.guild_id,
      admin_id: log.admin_id,
      action: log.action,
      details: JSON.stringify(log.details).substring(0, 50) + '...',
      created_at: log.created_at
    })));

    // Afficher les détails complets du dernier log
    console.log('\n📄 DÉTAILS DU DERNIER LOG:\n');
    console.log(JSON.stringify(logs[0], null, 2));

    // Statistiques par action
    console.log('\n📊 STATISTIQUES PAR TYPE D\'ACTION:\n');
    const actionStats = await db.queryAll(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `);
    console.table(actionStats);
  } else {
    console.log('\n⚠️  Aucune entrée dans la table audit_logs.');
    console.log('\n💡 Pour tester le système:');
    console.log('   1. Démarre le bot');
    console.log('   2. Utilise /admin-panel sur Discord');
    console.log('   3. Fais une action (créer un thème, ajouter un collectible, etc.)');
    console.log('   4. Relance ce script pour voir les logs');
  }

  // Vérifier aussi super_admin_logs
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 TABLE SUPER_ADMIN_LOGS (pour comparaison):\n');
  const superAdminCount = await db.queryOne('SELECT COUNT(*) as count FROM super_admin_logs');
  console.log(`✅ Total d'entrées: ${superAdminCount.count}`);

  if (superAdminCount.count > 0) {
    const superAdminLogs = await db.queryAll(`
      SELECT * FROM super_admin_logs
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.table(superAdminLogs);
  }

  // Vérifier give_logs pour comparaison
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 TABLE GIVE_LOGS (pour comparaison):\n');
  const giveCount = await db.queryOne('SELECT COUNT(*) as count FROM give_logs');
  console.log(`✅ Total d'entrées: ${giveCount.count}`);

  process.exit(0);
}

verifyAuditLogs().catch(error => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});
