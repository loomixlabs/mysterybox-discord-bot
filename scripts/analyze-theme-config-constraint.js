const db = require('../utils/database-pg');

async function analyzeConstraint() {
  try {
    console.log('🔍 ANALYSE CONTRAINTE check_probabilities_sum_100\n');
    console.log('='.repeat(80));

    // 1. Récupérer la définition de la contrainte
    console.log('\n📋 1. DÉFINITION DE LA CONTRAINTE:\n');
    const constraint = await db.queryOne(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'check_probabilities_sum_100'
        AND conrelid = 'theme_config'::regclass
    `);

    if (constraint) {
      console.log(`Nom: ${constraint.constraint_name}`);
      console.log(`Définition: ${constraint.definition}`);
    } else {
      console.log('⚠️  Contrainte introuvable !');
    }

    // 2. Structure de la table theme_config
    console.log('\n\n📋 2. COLONNES DE PROBABILITÉ DANS theme_config:\n');
    const columns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
        AND column_name LIKE '%prob%'
      ORDER BY ordinal_position
    `);

    console.table(columns);

    // 3. Vérifier les données actuelles
    console.log('\n\n📋 3. DONNÉES ACTUELLES (SERVEUR PRODUCTION):\n');
    const configs = await db.queryAll(`
      SELECT
        tc.*,
        t.name as theme_name
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE t.guild_id = $1
      ORDER BY t.created_at DESC
      LIMIT 5
    `, ['1248028543389143070']);

    if (configs.length > 0) {
      configs.forEach(config => {
        console.log(`\n🎨 Thème: ${config.theme_name} (ID: ${config.theme_id})`);

        // Extraire toutes les colonnes de probabilité
        const probColumns = Object.keys(config).filter(key => key.includes('prob'));
        let sum = 0;

        probColumns.forEach(col => {
          const value = config[col] || 0;
          console.log(`  ${col}: ${value}%`);
          sum += parseFloat(value);
        });

        console.log(`  ${'='.repeat(50)}`);
        console.log(`  TOTAL: ${sum}% ${sum === 100 ? '✅' : '❌ ERREUR!'}`);
      });
    } else {
      console.log('⚠️  Aucune configuration trouvée');
    }

    // 4. Lister TOUTES les colonnes de probabilité
    console.log('\n\n📋 4. TOUTES LES COLONNES DE theme_config:\n');
    const allColumns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      ORDER BY ordinal_position
    `);

    console.table(allColumns);

    console.log('\n✅ Analyse terminée');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyzeConstraint();
