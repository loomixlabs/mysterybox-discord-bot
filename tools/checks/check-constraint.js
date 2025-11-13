const db = require('./utils/database-pg');

async function checkConstraint() {
  try {
    console.log('🔍 Vérification de la contrainte campaign_type_check...\n');

    // Récupérer la définition de la contrainte
    const constraint = await db.queryAll(`
      SELECT
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conname = 'give_campaigns_campaign_type_check';
    `);

    console.log('📋 Contrainte trouvée:');
    console.table(constraint);

    // Vérifier les valeurs des campagnes existantes
    console.log('\n📊 Valeurs campaign_type existantes:');
    const values = await db.queryAll(`
      SELECT DISTINCT campaign_type, COUNT(*) as count
      FROM give_campaigns
      GROUP BY campaign_type;
    `);
    console.table(values);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkConstraint();
