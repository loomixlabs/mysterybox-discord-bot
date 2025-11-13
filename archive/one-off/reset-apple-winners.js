const db = require('./utils/database-pg');

async function resetAppleWinners() {
  try {
    console.log('🔄 Suppression des gagnants du jeu de la pomme...\n');

    await db.query(`DELETE FROM apple_game_winners`);

    console.log('✅ Tous les gagnants ont été supprimés !');
    console.log('Tu peux maintenant retester le mini-jeu.\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

resetAppleWinners();
