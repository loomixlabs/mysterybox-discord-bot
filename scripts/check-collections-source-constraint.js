const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

/**
 * Script de vérification de la contrainte collections_source_check
 * Affiche la définition actuelle de la contrainte
 */

async function checkSourceConstraint() {
  try {
    console.log('🔍 VÉRIFICATION - Contrainte collections_source_check\n');
    console.log('='.repeat(80));

    // Récupérer la définition de la contrainte
    const result = await pool.query(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'collections_source_check'
    `);

    const constraint = result.rows[0];

    if (!constraint) {
      console.log('❌ Contrainte collections_source_check NON TROUVÉE\n');
      console.log('='.repeat(80));
      process.exit(1);
    }

    console.log('\n📋 CONTRAINTE ACTUELLE:\n');
    console.log(`Nom: ${constraint.constraint_name}`);
    console.log(`Définition: ${constraint.definition}\n`);

    // Extraire les valeurs autorisées
    const match = constraint.definition.match(/CHECK \(\(source = ANY \(ARRAY\[(.*?)\]\)\)\)/);
    if (match) {
      const allowedValues = match[1].split(',').map(v => v.trim().replace(/'/g, ''));
      console.log('✅ Valeurs autorisées:', allowedValues.join(', '));
    } else {
      console.log('⚠️  Format de contrainte non reconnu');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🔍 ANALYSE:\n');

    // Vérifier les valeurs requises
    const requiredValues = ['give', 'mystery_box', 'mission'];
    const currentValues = match ? match[1].split(',').map(v => v.trim().replace(/'/g, '')) : [];

    const missing = requiredValues.filter(v => !currentValues.includes(v));

    if (missing.length > 0) {
      console.log('❌ Valeurs MANQUANTES dans la contrainte:');
      missing.forEach(v => console.log(`   - ${v}`));
      console.log('\n💡 SOLUTION: Mettre à jour la contrainte pour inclure ces valeurs\n');
    } else {
      console.log('✅ Toutes les valeurs requises sont présentes\n');
    }

    console.log('='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkSourceConstraint();
