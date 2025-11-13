const db = require('./utils/database-pg');

async function verifyMissionsConstraint() {
  console.log('🔍 VÉRIFICATION DE LA TABLE MISSIONS\n');
  console.log('='.repeat(80));

  // Vérifier les contraintes de la table missions
  console.log('\n📋 CONTRAINTES DE LA TABLE MISSIONS:\n');
  const constraints = await db.queryAll(`
    SELECT
      conname AS constraint_name,
      contype AS constraint_type,
      pg_get_constraintdef(c.oid) AS constraint_definition
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE cl.relname = 'missions'
    AND n.nspname = 'public'
    ORDER BY conname
  `);
  console.table(constraints);

  // Vérifier les missions existantes
  console.log('\n📝 MISSIONS EXISTANTES:\n');
  const missions = await db.queryAll(`
    SELECT guild_id, theme_id, mission_id, name, type
    FROM missions
    ORDER BY guild_id, theme_id, mission_id
  `);
  console.table(missions);

  // Compter les missions par guild_id et mission_id
  console.log('\n📊 COMPTAGE PAR (guild_id, mission_id):\n');
  const counts = await db.queryAll(`
    SELECT guild_id, mission_id, COUNT(*) as count
    FROM missions
    GROUP BY guild_id, mission_id
    HAVING COUNT(*) > 1
  `);

  if (counts.length > 0) {
    console.log('⚠️  DOUBLONS DÉTECTÉS:');
    console.table(counts);
  } else {
    console.log('✅ Aucun doublon détecté');
  }

  process.exit(0);
}

verifyMissionsConstraint().catch(error => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});
