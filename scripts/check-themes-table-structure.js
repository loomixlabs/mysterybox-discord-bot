/**
 * Vérifier la structure de la table themes (serveur)
 */
const db = require('../utils/database-pg');

async function check() {
  console.log('═'.repeat(80));
  console.log('🔍 STRUCTURE DE LA TABLE themes (SERVEUR)');
  console.log('═'.repeat(80));

  // 1. Colonnes de la table
  const cols = await db.queryAll(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'themes'
    ORDER BY ordinal_position
  `);

  console.log('\n📋 COLONNES:\n');
  console.table(cols.map(c => ({
    colonne: c.column_name,
    type: c.data_type,
    nullable: c.is_nullable
  })));

  // 2. Vérifier si is_draft existe
  const hasDraft = cols.some(c => c.column_name === 'is_draft');
  console.log(`\n❓ Colonne is_draft existe: ${hasDraft ? '✅ OUI' : '❌ NON'}`);

  process.exit(0);
}

check().catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});
