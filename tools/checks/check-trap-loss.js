const db = require('./utils/database-pg');
require('dotenv').config();

async function checkTrapLoss() {
  try {
    console.log('🔍 Vérification du piège de perte de collectible...\n');

    // Récupérer l'historique récent du joueur
    const history = await db.queryAll(`
      SELECT ph.*, p.username, p.discord_id
      FROM player_history ph
      JOIN players p ON ph.player_id = p.id
      WHERE p.discord_id = '297307186307006464'
      ORDER BY ph.created_at DESC
      LIMIT 10
    `);

    console.log(`📜 Historique récent (${history.length} entrées):\n`);
    history.forEach((entry, i) => {
      console.log(`${i + 1}. Action: ${entry.action}`);
      console.log(`   Détails: ${entry.details}`);
      console.log(`   Date: ${entry.created_at}`);
      console.log('');
    });

    // Vérifier les collections actuelles du joueur
    const player = await db.getPlayerByDiscordId('1248028543389143070', '297307186307006464');
    const theme = await db.getActiveTheme('1248028543389143070');
    const collectibles = await db.getPlayerCollectibles('1248028543389143070', player.id, theme.id);

    console.log(`📦 Collectibles actuels: ${collectibles.length}`);
    collectibles.forEach((col, i) => {
      console.log(`${i + 1}. ${col.name} (ID: ${col.id})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkTrapLoss();
