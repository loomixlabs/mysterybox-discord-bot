const db = require('./utils/database-pg');

async function listMissions() {
  try {
    const guildId = '297309737135898624';

    console.log('🎯 Liste des missions enregistrées:\n');

    const missions = await db.queryAll(`
      SELECT id, guild_id, theme_id, mission_id, name, type, description, validation_type,
             timeout, reward_type, reward_data, created_at
      FROM missions
      WHERE guild_id = $1
      ORDER BY id
    `, [guildId]);

    if (missions.length === 0) {
      console.log('❌ Aucune mission trouvée pour ce serveur.\n');
      console.log('💡 La table "missions" existe mais est vide.\n');
    } else {
      console.log(`✅ ${missions.length} mission(s) trouvée(s):\n`);
      missions.forEach(m => {
        console.log(`  📌 Mission #${m.id}: ${m.name}`);
        console.log(`     Mission ID: ${m.mission_id}`);
        console.log(`     Theme ID: ${m.theme_id}`);
        console.log(`     Type: ${m.type}`);
        console.log(`     Description: ${m.description}`);
        console.log(`     Validation: ${m.validation_type}`);
        console.log(`     Timeout: ${m.timeout}s`);
        console.log(`     Récompense: ${m.reward_type}`);
        console.log(`     Créée le: ${m.created_at}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

listMissions();
