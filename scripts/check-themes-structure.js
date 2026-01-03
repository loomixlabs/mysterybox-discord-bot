const db = require('../utils/database-pg');

async function checkThemesStructure() {
  try {
    console.log('🔍 VÉRIFICATION - Structure de la table themes\n');
    console.log('='.repeat(80));

    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'themes'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Colonnes de la table themes:\n');
    console.table(columns);

    console.log('\n' + '='.repeat(80));
    console.log('\n📦 Données du thème actif:\n');

    const GUILD_ID = '297309737135898624';
    const theme = await db.query(`
      SELECT *
      FROM themes
      WHERE guild_id = $1
      AND is_active = TRUE
      LIMIT 1
    `, [GUILD_ID]);

    if (theme.length > 0) {
      console.log('✅ Thème actif trouvé:\n');
      console.table(theme);
    } else {
      console.log('❌ Aucun thème actif trouvé\n');
    }

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkThemesStructure();
