const db = require('./utils/database-pg');

async function checkWinners() {
  try {
    console.log('🔍 Vérification des gagnants du jeu de la pomme...\n');

    const winners = await db.queryAll(`
      SELECT user_id, guild_id, won_at
      FROM apple_game_winners
      ORDER BY won_at
    `);

    if (!winners || winners.length === 0) {
      console.log('❌ Aucun gagnant pour le moment.');
    } else {
      console.log(`✅ ${winners.length} gagnant(s) trouvé(s):\n`);
      winners.forEach((winner, index) => {
        console.log(`${index + 1}. User ID: ${winner.user_id}`);
        console.log(`   Date: ${winner.won_at}`);
        console.log('');
      });
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkWinners();
