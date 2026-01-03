/**
 * Vérifier que tous les 17 templates d'annonces existent dans la DB
 */
const db = require('../utils/database-pg');

const EXPECTED_TEMPLATES = [
  'legendary_collectible',
  'collection_completed',
  'collection_traded',
  'collection_lost',
  'trap_cooldown',
  'trap_lose_collectible',
  'trap_public_shame',
  'trap_empty_box',
  'trap_lose_all_collectibles',
  'mission_word_guessed',
  'mission_started',
  'mission_completed',
  'mission_failed',
  'mission_approved',
  'mission_rejected',
  'theme_expired',
  'theme_expiring_soon'
];

async function verify() {
  try {
    console.log('🔍 VÉRIFICATION TEMPLATES D\'ANNONCES\n');
    console.log('='.repeat(80));

    // 1. Liste des guilds
    console.log('\n📋 1. GUILDS AVEC TEMPLATES:\n');
    const guilds = await db.queryAll(`
      SELECT DISTINCT guild_id, COUNT(*) as template_count
      FROM announcement_templates
      GROUP BY guild_id
      ORDER BY guild_id
    `);
    console.table(guilds);

    // 2. Vérifier chaque guild
    for (const guild of guilds) {
      console.log(`\n📋 GUILD ${guild.guild_id}: ${guild.template_count} templates\n`);

      const templates = await db.queryAll(`
        SELECT type FROM announcement_templates WHERE guild_id = $1 ORDER BY type
      `, [guild.guild_id]);

      const existingTypes = templates.map(t => t.type);

      // Trouver les templates manquants
      const missing = EXPECTED_TEMPLATES.filter(t => !existingTypes.includes(t));
      const obsolete = existingTypes.filter(t => !EXPECTED_TEMPLATES.includes(t));

      if (missing.length > 0) {
        console.log('   ❌ TEMPLATES MANQUANTS:');
        missing.forEach(t => console.log(`      - ${t}`));
      } else {
        console.log('   ✅ Tous les templates attendus existent');
      }

      if (obsolete.length > 0) {
        console.log('\n   ⚠️ TEMPLATES OBSOLÈTES (à supprimer):');
        obsolete.forEach(t => console.log(`      - ${t}`));
      }
    }

    // 3. Résumé
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RÉSUMÉ:');
    console.log(`   Templates attendus: ${EXPECTED_TEMPLATES.length}`);
    console.log(`   Guilds configurées: ${guilds.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verify();
