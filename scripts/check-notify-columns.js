const db = require('../utils/database-pg');

async function check() {
  try {
    console.log('=== Vérification colonnes notify dans guild_config ===\n');

    // Vérifier structure guild_config
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'guild_config'
        AND column_name LIKE 'notify%'
      ORDER BY ordinal_position
    `);

    console.log('Colonnes notify_ trouvées:');
    if (columns.length === 0) {
      console.log('AUCUNE COLONNE notify_ TROUVÉE !');
    } else {
      console.table(columns);
    }

    // Vérifier les valeurs pour le serveur
    console.log('\n=== Valeurs pour 1248028543389143070 ===');
    const guildData = await db.queryOne(`
      SELECT *
      FROM guild_config
      WHERE guild_id = '1248028543389143070'
    `);

    if (!guildData) {
      console.log('AUCUNE ENTRÉE guild_config POUR CE SERVEUR !');
    } else {
      console.log('Données guild_config:');
      for (const [key, value] of Object.entries(guildData)) {
        if (key.startsWith('notify_')) {
          console.log(`  ${key}: ${value}`);
        }
      }
    }

    process.exit(0);
  } catch(e) {
    console.error('Erreur:', e.message);
    process.exit(1);
  }
}

check();
