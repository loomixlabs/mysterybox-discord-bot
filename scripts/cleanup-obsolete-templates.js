/**
 * Nettoyer les templates d'annonces obsolètes de la base de données
 */
const db = require('../utils/database-pg');

const OBSOLETE_TYPES = ['trap_curse', 'trap_malus_points'];

async function cleanup() {
  try {
    console.log('🧹 NETTOYAGE TEMPLATES OBSOLÈTES\n');
    console.log('='.repeat(80));

    // 1. Trouver les templates obsolètes
    console.log('\n📋 Templates obsolètes à supprimer:\n');
    const obsoleteTemplates = await db.queryAll(`
      SELECT id, guild_id, type, title
      FROM announcement_templates
      WHERE type = ANY($1)
      ORDER BY guild_id, type
    `, [OBSOLETE_TYPES]);

    if (obsoleteTemplates.length === 0) {
      console.log('   ✅ Aucun template obsolète trouvé');
      process.exit(0);
    }

    console.table(obsoleteTemplates);

    // 2. Supprimer les templates obsolètes
    console.log('\n🗑️  Suppression en cours...\n');
    const result = await db.query(`
      DELETE FROM announcement_templates
      WHERE type = ANY($1)
    `, [OBSOLETE_TYPES]);

    console.log(`   ✅ ${obsoleteTemplates.length} template(s) obsolète(s) supprimé(s)`);

    // 3. Vérification finale
    console.log('\n📊 Vérification finale:\n');
    const remaining = await db.queryAll(`
      SELECT guild_id, COUNT(*) as template_count
      FROM announcement_templates
      GROUP BY guild_id
      ORDER BY guild_id
    `);
    console.table(remaining);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ NETTOYAGE TERMINÉ');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

cleanup();
