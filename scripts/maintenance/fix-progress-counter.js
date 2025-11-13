const db = require('./utils/database-pg');
require('dotenv').config();

async function fixProgressCounter() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '692649463805640724'; // floerin

    console.log('🔧 Correction du compteur de progression\n');

    // 1. Récupérer le joueur
    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    console.log(`Joueur: ${player.username}\n`);

    // 2. Compter les collectibles actifs (non perdus)
    const count = await db.queryOne(`
      SELECT COUNT(*) as total FROM collections
      WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
    `, [guildId, player.id]);

    console.log(`📊 Collectibles actifs dans la BDD: ${count.total}`);

    // 3. Récupérer le thème actuel
    const theme = await db.queryOne(`
      SELECT id, name, required_items FROM themes
      WHERE guild_id = $1 AND name LIKE '%Blanche%'
      LIMIT 1
    `, [guildId]);

    console.log(`🎨 Thème: ${theme.name} (${theme.required_items} requis)\n`);

    // 4. Vérifier le compteur actuel
    const currentProgress = await db.queryOne(`
      SELECT collected_count FROM player_progress
      WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
    `, [guildId, player.id, theme.id]);

    console.log(`❌ Compteur ACTUEL: ${currentProgress.collected_count}/${theme.required_items}`);
    console.log(`✅ Compteur CORRECT: ${count.total}/${theme.required_items}\n`);

    if (currentProgress.collected_count === parseInt(count.total)) {
      console.log('✅ Le compteur est déjà correct !');
      process.exit(0);
    }

    // 5. Corriger le compteur
    console.log('🔧 Mise à jour du compteur...\n');

    await db.query(`
      UPDATE player_progress
      SET collected_count = $1
      WHERE guild_id = $2 AND player_id = $3 AND theme_id = $4
    `, [parseInt(count.total), guildId, player.id, theme.id]);

    console.log(`✅ Compteur corrigé: ${count.total}/${theme.required_items}`);
    console.log('\n🎉 Progression synchronisée avec succès !');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixProgressCounter();
