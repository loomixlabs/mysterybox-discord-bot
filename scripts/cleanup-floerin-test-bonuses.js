require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070'; // Serveur de production
const USER_ID = '692649463805640724'; // floerin

async function cleanup() {
  try {
    console.log('🧹 NETTOYAGE DES BONUS DE TEST - FLOERIN\n');
    console.log('='.repeat(80));

    // 1. Vérifier les bonus actuels
    console.log('\n📋 Bonus actuels de floerin:\n');
    const current = await db.queryAll(`
      SELECT
        pab.id,
        sb.name as bonus_name,
        sb.icon,
        pab.is_active,
        pab.obtained_from,
        pab.activated_at
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.user_id = $2
      ORDER BY pab.activated_at
    `, [GUILD_ID, USER_ID]);

    if (current.length === 0) {
      console.log('✅ Aucun bonus trouvé pour floerin');
      process.exit(0);
      return;
    }

    console.table(current);
    console.log(`\n📊 Total: ${current.length} bonus à supprimer\n`);

    // 2. Supprimer tous les bonus de test
    const result = await db.queryOne(`
      DELETE FROM player_active_bonuses
      WHERE guild_id = $1 AND user_id = $2
      RETURNING *
    `, [GUILD_ID, USER_ID]);

    console.log(`✅ Suppression effectuée: ${current.length} bonus supprimé(s)\n`);

    // 3. Vérification finale
    const final = await db.queryAll(`
      SELECT COUNT(*) as remaining
      FROM player_active_bonuses
      WHERE guild_id = $1 AND user_id = $2
    `, [GUILD_ID, USER_ID]);

    console.log(`🔍 Vérification finale: ${final[0].remaining} bonus restant(s)\n`);

    if (final[0].remaining === 0) {
      console.log('✅ Nettoyage terminé avec succès !');
    } else {
      console.error('⚠️  Il reste des bonus, nouvelle tentative nécessaire');
    }

    console.log('\n' + '='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

cleanup();
