require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function check() {
  try {
    console.log('🔍 VÉRIFICATION DES DOUBLONS PARRAIN/MARRAINE\n');
    console.log('='.repeat(80));

    // Rechercher tous les bonus "Parrain/Marraine"
    const parrains = await db.queryAll(`
      SELECT
        id,
        bonus_id,
        name,
        description,
        icon,
        rarity,
        effect_type,
        activation_mode,
        is_enabled
      FROM super_bonuses
      WHERE guild_id = $1
        AND name ILIKE '%parrain%'
      ORDER BY id
    `, [GUILD_ID]);

    console.log('\n📋 Bonus trouvés avec "Parrain" dans le nom:\n');
    console.table(parrains);

    if (parrains.length > 1) {
      console.log(`\n⚠️  ${parrains.length} entrées trouvées ! Doublons détectés.\n`);

      // Garder le premier, supprimer les autres
      const toKeep = parrains[0];
      const toDelete = parrains.slice(1);

      console.log(`✅ À conserver: ID ${toKeep.id} - ${toKeep.icon} ${toKeep.name}`);
      console.log(`❌ À supprimer: ${toDelete.map(d => `ID ${d.id}`).join(', ')}\n`);

      // Vérifier s'il y a des activations liées
      for (const bonus of toDelete) {
        const activations = await db.queryAll(`
          SELECT COUNT(*) as count
          FROM player_active_bonuses
          WHERE guild_id = $1 AND bonus_id = $2
        `, [GUILD_ID, bonus.id]);

        console.log(`   ID ${bonus.id}: ${activations[0].count} activation(s)`);
      }
    } else if (parrains.length === 1) {
      console.log('✅ Aucun doublon trouvé');
    } else {
      console.log('❌ Aucun bonus "Parrain/Marraine" trouvé');
    }

    console.log('\n' + '='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
