const db = require('./utils/database-pg');

async function checkKeywordsStructure() {
  try {
    console.log('🔍 Vérification de la structure de mission_keywords...\n');

    // Récupérer la structure de la table
    const columns = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'mission_keywords'
      ORDER BY ordinal_position
    `);

    console.log('📋 Structure actuelle de la table mission_keywords:\n');
    columns.forEach(col => {
      console.log(`  ${col.column_name}:`);
      console.log(`    Type: ${col.data_type}`);
      console.log(`    Default: ${col.column_default || 'NULL'}`);
      console.log(`    Nullable: ${col.is_nullable}`);
      if (col.character_maximum_length) {
        console.log(`    Max Length: ${col.character_maximum_length}`);
      }
      console.log('');
    });

    // Vérifier si la colonne difficulty existe déjà
    const hasDifficulty = columns.some(col => col.column_name === 'difficulty');

    if (hasDifficulty) {
      console.log('✅ La colonne "difficulty" existe déjà dans la table.');

      // Compter les keywords existants
      const countResult = await db.queryOne('SELECT COUNT(*) as count FROM mission_keywords');
      console.log(`\n📊 Nombre de mots-clés existants: ${countResult.count}`);

      // Afficher quelques exemples
      const keywords = await db.queryAll('SELECT id, keyword, difficulty, target_channel_id FROM mission_keywords LIMIT 5');
      if (keywords.length > 0) {
        console.log('\n🔤 Exemples de mots-clés:');
        keywords.forEach(k => {
          console.log(`  - ID ${k.id}: "${k.keyword}" (difficulté: ${k.difficulty || 'non défini'})`);
        });
      }
    } else {
      console.log('❌ La colonne "difficulty" n\'existe PAS encore dans la table.');
      console.log('\n💡 La migration doit être exécutée pour ajouter cette colonne.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkKeywordsStructure();
