/**
 * Quick check for TODO tasks 7 and 8
 */
require('dotenv').config();
const db = require('../utils/database-pg');

async function main() {
  console.log('='.repeat(60));
  console.log('TASK 7: TEMPLATES ANNONCES TRAP');
  console.log('='.repeat(60));

  const trapTemplates = await db.queryAll(`
    SELECT type, title FROM announcement_templates
    WHERE type LIKE '%trap%' OR type LIKE '%malus%'
    ORDER BY type
  `);
  console.log('\nTemplates trouvés:');
  trapTemplates.forEach(t => console.log(`  - ${t.type}: "${t.title}"`));

  // Check if trap_malus_points exists
  const hasMalus = trapTemplates.some(t => t.type === 'trap_malus_points');
  console.log(`\ntrap_malus_points existe: ${hasMalus ? '⚠️ OUI (à supprimer)' : '✅ NON'}`);

  console.log('\n' + '='.repeat(60));
  console.log('TASK 8: STRUCTURE super_bonuses');
  console.log('='.repeat(60));

  const columns = await db.queryAll(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'super_bonuses'
    ORDER BY ordinal_position
  `);

  console.log('\nColonnes de la table super_bonuses:');
  columns.forEach(c => console.log(`  - ${c.column_name} (${c.data_type}, ${c.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`));

  const hasIsActive = columns.some(c => c.column_name === 'is_active');
  console.log(`\nColonne is_active: ${hasIsActive ? '✅ Existe' : '❌ N\'existe PAS'}`);

  // Count super bonuses
  const count = await db.queryOne(`SELECT COUNT(*) as total FROM super_bonuses`);
  const countByEnabled = await db.queryAll(`
    SELECT is_enabled, COUNT(*) as count FROM super_bonuses GROUP BY is_enabled
  `);

  console.log(`\nTotal super bonuses: ${count.total}`);
  countByEnabled.forEach(c => console.log(`  - is_enabled=${c.is_enabled}: ${c.count}`));

  process.exit(0);
}

main().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
