const db = require('../utils/database-pg');

async function checkThemeConfigStructure() {
  try {
    console.log('🔍 VÉRIFICATION - Structure table theme_config\n');
    console.log('='.repeat(80));

    // Récupérer les contraintes CHECK
    const constraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'theme_config'::regclass
    `);
    console.log('\n📊 Contraintes theme_config:');
    console.table(constraints);

    // Vérifier les probabilités qui doivent sommer à 100
    console.log('\n📊 Somme des probabilités par thème:');
    const sums = await db.queryAll(`
      SELECT tc.theme_id, t.name,
             tc.probability_collectible + tc.probability_mission + tc.probability_trap as total_probs,
             tc.probability_collectible, tc.probability_mission, tc.probability_trap, tc.probability_super_bonus
      FROM theme_config tc
      LEFT JOIN themes t ON tc.theme_id = t.id AND tc.guild_id = t.guild_id
    `);
    console.table(sums);

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkThemeConfigStructure();
