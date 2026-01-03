require('dotenv').config();
const db = require('../utils/database-pg');

const SERVERS = [
  { id: '297309737135898624', name: 'Serveur TEST' },
  { id: '1248028543389143070', name: 'Serveur PRODUCTION' }
];

async function check() {
  try {
    console.log('🔍 VÉRIFICATION DE TOUS LES DOUBLONS DANS player_active_bonuses\n');
    console.log('='.repeat(80));

    for (const server of SERVERS) {
      console.log(`\n📊 ${server.name} (${server.id})\n`);

      // Rechercher tous les doublons (même user_id + même bonus_id)
      const duplicates = await db.queryAll(`
        SELECT
          pab.user_id,
          pab.bonus_id,
          sb.name as bonus_name,
          sb.icon,
          p.username,
          COUNT(*) as count,
          array_agg(pab.id ORDER BY pab.id) as pab_ids,
          array_agg(pab.obtained_from ORDER BY pab.id) as sources,
          array_agg(pab.is_active ORDER BY pab.id) as active_states
        FROM player_active_bonuses pab
        JOIN super_bonuses sb ON pab.bonus_id = sb.id
        LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
        WHERE pab.guild_id = $1
        GROUP BY pab.user_id, pab.bonus_id, sb.name, sb.icon, p.username
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC, p.username
      `, [server.id]);

      if (duplicates.length === 0) {
        console.log('✅ Aucun doublon trouvé\n');
      } else {
        console.log(`❌ ${duplicates.length} doublon(s) détecté(s):\n`);

        duplicates.forEach((dup, index) => {
          console.log(`${index + 1}. 👤 ${dup.username || dup.user_id}`);
          console.log(`   Bonus: ${dup.icon} ${dup.bonus_name}`);
          console.log(`   Nombre d'entrées: ${dup.count}`);
          console.log(`   IDs PAB: ${dup.pab_ids.join(', ')}`);
          console.log(`   Sources: ${dup.sources.join(', ')}`);
          console.log(`   États actifs: ${dup.active_states.map(a => a ? '✅' : '❌').join(', ')}`);
          console.log('');
        });

        // Suggérer la correction
        console.log('💡 RECOMMANDATION:');
        console.log('   Pour chaque doublon, conserver la première entrée (ID le plus bas)');
        console.log('   et supprimer les autres.\n');
      }

      console.log('-'.repeat(80));
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Vérification terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
