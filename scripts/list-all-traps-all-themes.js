const db = require('../utils/database-pg');

async function listAllTraps() {
  try {
    const guildId = '1248028543389143070';

    console.log('🔍 LISTE COMPLÈTE DE TOUS LES PIÈGES\n');
    console.log('='.repeat(80));

    // Récupérer TOUS les pièges de TOUS les thèmes
    const allTraps = await db.query(`
      SELECT
        t.id,
        t.name,
        t.type,
        t.cooldown_duration,
        th.name as theme_name,
        th.is_active
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE th.guild_id = $1
      ORDER BY th.is_active DESC, th.name, t.name
    `, [guildId]);

    console.log(`📊 Total: ${allTraps.length} piège(s)\n`);

    let currentTheme = '';
    allTraps.forEach((trap, i) => {
      if (trap.theme_name !== currentTheme) {
        currentTheme = trap.theme_name;
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📚 THÈME: ${trap.theme_name} ${trap.is_active ? '(✅ ACTIF)' : '(❌ Inactif)'}`);
        console.log('='.repeat(80));
      }

      console.log(`\n${i + 1}. ${trap.name} (ID: ${trap.id})`);
      console.log(`   Type: ${trap.type}`);
      console.log(`   Cooldown: ${trap.cooldown_duration} minutes`);
      if (trap.cooldown_duration > 0) {
        console.log(`   ⚠️  CE PIÈGE A UN COOLDOWN!`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Liste complète affichée\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

listAllTraps();
