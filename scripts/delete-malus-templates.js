/**
 * Suppression des templates trap_malus_points
 * (type de piège non implémenté)
 */
require('dotenv').config();
const db = require('../utils/database-pg');

async function main() {
  console.log('🗑️ Suppression des templates trap_malus_points...\n');

  // Show what will be deleted
  const toDelete = await db.queryAll(`
    SELECT id, guild_id, type, title FROM announcement_templates
    WHERE type = 'trap_malus_points'
  `);

  if (toDelete.length === 0) {
    console.log('✅ Aucun template trap_malus_points trouvé');
    process.exit(0);
  }

  console.log(`Templates à supprimer (${toDelete.length}):`);
  toDelete.forEach(t => console.log(`  - ID ${t.id}: "${t.title}" (guild: ${t.guild_id})`));

  // Delete
  const result = await db.query(`
    DELETE FROM announcement_templates
    WHERE type = 'trap_malus_points'
    RETURNING id
  `);

  console.log(`\n✅ ${result.rowCount} template(s) supprimé(s)`);

  // Verify
  const remaining = await db.queryAll(`
    SELECT type, COUNT(*) as count FROM announcement_templates
    WHERE type LIKE '%trap%'
    GROUP BY type
    ORDER BY type
  `);

  console.log('\nTemplates pièges restants:');
  remaining.forEach(r => console.log(`  - ${r.type}: ${r.count}`));

  process.exit(0);
}

main().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
