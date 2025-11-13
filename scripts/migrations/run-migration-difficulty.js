const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔧 Exécution de la migration difficulty...\n');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, 'database', 'migrations', 'add-keyword-difficulty.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Exécuter la migration
    await db.query(sql);
    console.log('✅ Migration exécutée avec succès\n');

    // Vérifier que la colonne existe
    const columnCheck = await db.queryOne(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'mission_keywords'
        AND column_name = 'difficulty'
    `);

    if (columnCheck) {
      console.log('✅ Colonne difficulty créée avec succès');
      console.log(`   Type: ${columnCheck.data_type}`);
      console.log(`   Default: ${columnCheck.column_default}\n`);

      // Afficher la structure actuelle de la table mission_keywords
      const columns = await db.queryAll(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'mission_keywords'
        ORDER BY ordinal_position
      `);

      console.log('📋 Structure complète de la table mission_keywords:\n');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
      });

      // Vérifier les keywords existants
      const keywordCount = await db.queryOne('SELECT COUNT(*) as count FROM mission_keywords');
      console.log(`\n📊 Nombre de mots-clés existants: ${keywordCount.count}`);

      if (parseInt(keywordCount.count) > 0) {
        const keywords = await db.queryAll('SELECT id, keyword, difficulty FROM mission_keywords LIMIT 5');
        console.log('\n🔤 Exemples de mots-clés avec difficulty:');
        keywords.forEach(k => {
          console.log(`  - ID ${k.id}: "${k.keyword}" → difficulty: ${k.difficulty || 'NULL'}`);
        });
      }
    } else {
      console.error('❌ La colonne difficulty n\'a pas été créée');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
