const db = require('./utils/database-pg');

async function checkColumns() {
  try {
    console.log('🔍 Vérification des colonnes trap dans announcement_settings...\n');

    // Vérifier les colonnes
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
        AND column_name LIKE 'trap%'
      ORDER BY column_name
    `);

    console.log('📊 Colonnes trouvées:');
    console.table(columns);

    // Vérifier les valeurs pour le guild
    console.log('\n📋 Valeurs actuelles dans announcement_settings:');
    const settings = await db.queryAll(`
      SELECT guild_id, trap_curse, trap_cooldown, trap_lose_collectible, trap_public_shame, trap_malus_points
      FROM announcement_settings
    `);

    if (settings.length > 0) {
      console.table(settings);
    } else {
      console.log('⚠️  Aucune donnée dans announcement_settings');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkColumns();
