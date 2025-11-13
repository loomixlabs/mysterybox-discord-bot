const db = require('./utils/database-pg');

async function checkLogsStructure() {
  console.log('🔍 VÉRIFICATION DES TABLES DE LOGS\n');
  console.log('='.repeat(80));

  // Super admin logs
  console.log('\n📊 1. SUPER_ADMIN_LOGS\n');
  const superAdminCols = await db.queryAll(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'super_admin_logs' ORDER BY ordinal_position`
  );
  console.table(superAdminCols);

  const superAdminCount = await db.queryOne('SELECT COUNT(*) as count FROM super_admin_logs');
  console.log(`\n✅ Total d'entrées: ${superAdminCount.count}`);

  if (superAdminCount.count > 0) {
    const samples = await db.queryAll('SELECT * FROM super_admin_logs LIMIT 3');
    console.log('\n📝 Exemples:');
    console.table(samples);
  }

  // Audit logs
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 2. AUDIT_LOGS\n');
  const auditCols = await db.queryAll(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position`
  );
  console.table(auditCols);

  const auditCount = await db.queryOne('SELECT COUNT(*) as count FROM audit_logs');
  console.log(`\n✅ Total d'entrées: ${auditCount.count}`);

  if (auditCount.count > 0) {
    const samples = await db.queryAll('SELECT * FROM audit_logs LIMIT 3');
    console.log('\n📝 Exemples:');
    console.table(samples);
  }

  // Give logs (pour comparaison)
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 3. GIVE_LOGS (pour comparaison)\n');
  const giveCols = await db.queryAll(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'give_logs' ORDER BY ordinal_position`
  );
  console.table(giveCols);

  const giveCount = await db.queryOne('SELECT COUNT(*) as count FROM give_logs');
  console.log(`\n✅ Total d'entrées: ${giveCount.count}`);

  if (giveCount.count > 0) {
    const samples = await db.queryAll('SELECT * FROM give_logs LIMIT 3');
    console.log('\n📝 Exemples:');
    console.table(samples);
  }

  process.exit(0);
}

checkLogsStructure();
