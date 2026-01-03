/**
 * Vérification des super bonus actifs pour le serveur de test
 */

const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 Vérification super bonuses pour le serveur de test');
  console.log('='.repeat(60));

  try {
    const guildId = '297309737135898624';

    const superBonuses = await db.queryAll(`
      SELECT id, name, is_enabled, effect_type, duration_value
      FROM super_bonuses
      WHERE guild_id = $1
      ORDER BY name
    `, [guildId]);

    console.log(`\n📋 Super bonus trouvés: ${superBonuses.length}`);

    if (superBonuses.length > 0) {
      console.log('\n┌────┬──────────────────────────────┬─────────┬────────────────────┬──────────┐');
      console.log('│ ID │ Nom                          │ Actif   │ Type effet         │ Durée    │');
      console.log('├────┼──────────────────────────────┼─────────┼────────────────────┼──────────┤');

      for (const sb of superBonuses) {
        const id = String(sb.id).padEnd(2);
        const name = (sb.name || '?').substring(0, 28).padEnd(28);
        const active = sb.is_enabled ? '✅ Oui ' : '❌ Non ';
        const type = (sb.effect_type || '?').substring(0, 18).padEnd(18);
        const duration = sb.duration_value ? `${Math.round(sb.duration_value / 3600)}h` : '24h';
        console.log(`│ ${id} │ ${name} │ ${active} │ ${type} │ ${duration.padEnd(8)} │`);
      }

      console.log('└────┴──────────────────────────────┴─────────┴────────────────────┴──────────┘');

      const activeCount = superBonuses.filter(sb => sb.is_enabled).length;
      console.log(`\n✅ ${activeCount} super bonus ACTIFS sur ${superBonuses.length} total`);

      if (activeCount === 0) {
        console.log('\n⚠️  ATTENTION: Aucun super bonus actif !');
        console.log('   Les missions avec reward_type="super-bonus" donneront un collectible à la place.');
      }
    } else {
      console.log('\n❌ Aucun super bonus trouvé pour ce serveur!');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

check();
