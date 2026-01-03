require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
  try {
    console.log('🔍 VÉRIFICATION DE LA COLONNE final_role_discord_id\n');
    console.log('='.repeat(80));

    // Vérifier la structure de la table themes
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'themes'
        AND column_name LIKE '%role%'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Colonnes de rôle dans la table themes:');
    console.table(columns);

    // Vérifier un thème actif
    const GUILD_ID = '1248028543389143070';
    const theme = await db.queryOne(
      'SELECT id, name, final_role_name, final_role_color, final_role_discord_id FROM themes WHERE guild_id = $1 AND is_active = TRUE',
      [GUILD_ID]
    );

    console.log('\n🎨 Thème actif:');
    console.table([theme]);

    if (theme && theme.final_role_discord_id) {
      console.log('\n✅ La colonne final_role_discord_id existe et contient une valeur:', theme.final_role_discord_id);
    } else if (theme && !theme.final_role_discord_id) {
      console.log('\n⚠️  La colonne existe mais est NULL pour ce thème');
    } else {
      console.log('\n❌ Aucun thème actif trouvé');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
