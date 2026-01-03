const db = require('../utils/database-pg');

async function checkTrapTriggeredStructure() {
  try {
    const guildId = '1248028543389143070';
    const userId = '297307186307006464'; // xmicordix

    console.log('🔍 STRUCTURE ET DONNÉES DE trap_triggered\n');
    console.log('='.repeat(80));

    // 1. Récupérer le player_id
    const player = await db.queryOne(
      `SELECT id, username FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    console.log(`✅ Player: ${player.username} (ID: ${player.id})\n`);

    // 2. Récupérer la structure de la table
    console.log('📋 COLONNES DE trap_triggered:');
    console.log('-'.repeat(80));
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'trap_triggered'
      ORDER BY ordinal_position
    `);

    columns.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
    });

    // 3. Récupérer TOUTES les données de trap_triggered pour ce joueur
    console.log('\n📊 DONNÉES COMPLÈTES pour xmicordix:');
    console.log('-'.repeat(80));
    const traps = await db.query(
      `SELECT * FROM trap_triggered WHERE guild_id = $1 AND player_id = $2 ORDER BY triggered_at DESC`,
      [guildId, player.id]
    );

    console.log(`   Total: ${traps.length} piège(s) déclenché(s)\n`);

    traps.forEach((trap, index) => {
      console.log(`\n   ${index + 1}. Trap ID: ${trap.trap_id}`);
      console.log(`      triggered_at: ${new Date(trap.triggered_at).toLocaleString('fr-FR')}`);

      // Afficher TOUTES les colonnes
      Object.keys(trap).forEach(key => {
        if (key !== 'trap_id' && key !== 'triggered_at' && key !== 'guild_id' && key !== 'player_id') {
          console.log(`      ${key}: ${trap[key]}`);
        }
      });
    });

    // 4. Récupérer les infos du trap 17 (celui déclenché en dernier)
    console.log('\n\n🎯 DÉTAILS DU PIÈGE 17:');
    console.log('-'.repeat(80));
    const trap17 = await db.queryOne(
      `SELECT * FROM traps WHERE id = 17`
    );

    if (trap17) {
      console.log(`   Nom: ${trap17.name}`);
      console.log(`   Description: ${trap17.description}`);
      Object.keys(trap17).forEach(key => {
        if (key !== 'name' && key !== 'description') {
          console.log(`   ${key}: ${trap17[key]}`);
        }
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Vérification terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkTrapTriggeredStructure();
