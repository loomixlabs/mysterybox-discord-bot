/**
 * Script de vérification COMPLET - Table themes_library
 * Analyse structure + contenu + comparaison avec LibrarySection.js
 */

const db = require('../utils/database-pg');

async function checkThemesLibrary() {
  try {
    console.log('='.repeat(80));
    console.log('🔍 ANALYSE COMPLÈTE - TABLE themes_library');
    console.log('='.repeat(80));

    // 1. Structure de la table
    console.log('\n📋 STRUCTURE DE LA TABLE:\n');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'themes_library'
      ORDER BY ordinal_position
    `);

    if (columns.length === 0) {
      console.log('❌ TABLE themes_library N\'EXISTE PAS!');
      process.exit(1);
    }

    console.table(columns);

    // 2. Contraintes
    console.log('\n🔒 CONTRAINTES:\n');
    const constraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'themes_library'::regclass
    `);
    if (constraints.length > 0) {
      console.table(constraints);
    } else {
      console.log('  Aucune contrainte');
    }

    // 3. Index
    console.log('\n📊 INDEX:\n');
    const indexes = await db.queryAll(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'themes_library'
    `);
    if (indexes.length > 0) {
      console.table(indexes);
    } else {
      console.log('  Aucun index');
    }

    // 4. Données existantes
    console.log('\n📦 THÈMES EN BIBLIOTHÈQUE (10 derniers):\n');
    const themes = await db.queryAll(`
      SELECT id, name, user_id, author_username, is_public, is_featured, is_draft,
             rating, download_count, view_count, category, difficulty,
             created_at
      FROM themes_library
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (themes.length > 0) {
      console.table(themes.map(t => ({
        id: t.id,
        name: t.name?.substring(0, 25),
        author: t.author_username?.substring(0, 15),
        public: t.is_public ? '✅' : '❌',
        featured: t.is_featured ? '⭐' : '-',
        draft: t.is_draft ? '📝' : '✅',
        rating: t.rating || '-',
        downloads: t.download_count || 0,
        views: t.view_count || 0,
        category: t.category || '-',
        difficulty: t.difficulty || '-'
      })));
    } else {
      console.log('  Aucun thème trouvé');
    }

    // 5. Statistiques globales
    console.log('\n📈 STATISTIQUES GLOBALES:\n');
    const stats = await db.queryOne(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_public = true) as public_count,
        COUNT(*) FILTER (WHERE is_featured = true) as featured_count,
        COUNT(*) FILTER (WHERE is_draft = true) as draft_count,
        COALESCE(AVG(rating), 0)::numeric(3,2) as avg_rating,
        COALESCE(SUM(download_count), 0) as total_downloads,
        COALESCE(SUM(view_count), 0) as total_views
      FROM themes_library
    `);

    console.log(`  Total thèmes        : ${stats.total}`);
    console.log(`  Thèmes publics      : ${stats.public_count}`);
    console.log(`  Thèmes en vedette   : ${stats.featured_count}`);
    console.log(`  Brouillons          : ${stats.draft_count}`);
    console.log(`  Note moyenne        : ${stats.avg_rating}`);
    console.log(`  Total téléchargements: ${stats.total_downloads}`);
    console.log(`  Total vues          : ${stats.total_views}`);

    // 6. Analyse des colonnes vs LibrarySection.js
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALYSE ALIGNEMENT UI (LibrarySection.js) vs DB');
    console.log('='.repeat(80));

    const columnNames = columns.map(c => c.column_name);

    // Colonnes utilisées dans LibrarySection.js (basé sur le code lu)
    const uiUsedColumns = [
      'id',
      'name',
      'author_username',
      'is_public',
      'is_featured',
      'is_draft',
      'rating',
      'download_count',
      'view_count',
      'weekly_downloads',
      'category',
      'difficulty',
      'color',
      'icon',
      'description',
      'collectibles_count',
      'traps_count',
      'missions_count',
      'created_at'
    ];

    console.log('\n✅ Colonnes présentes en DB et utilisées dans l\'UI:');
    const presentInBoth = uiUsedColumns.filter(c => columnNames.includes(c));
    presentInBoth.forEach(c => console.log(`   ✓ ${c}`));

    console.log('\n❌ Colonnes utilisées dans l\'UI mais ABSENTES de la DB:');
    const missingInDb = uiUsedColumns.filter(c => !columnNames.includes(c));
    if (missingInDb.length > 0) {
      missingInDb.forEach(c => console.log(`   ✗ ${c} (MANQUANT!)`));
    } else {
      console.log('   Aucune');
    }

    console.log('\n📦 Colonnes en DB non utilisées dans l\'UI:');
    const unusedInDb = columnNames.filter(c => !uiUsedColumns.includes(c));
    if (unusedInDb.length > 0) {
      unusedInDb.forEach(c => console.log(`   ? ${c}`));
    } else {
      console.log('   Aucune');
    }

    // 7. Fonctionnalités communautaires
    console.log('\n' + '='.repeat(80));
    console.log('🌍 FONCTIONNALITÉS COMMUNAUTAIRES (Featured/Trending)');
    console.log('='.repeat(80));

    // Vérifier les endpoints API utilisés
    console.log('\n📡 Endpoints API requis par LibrarySection.js:');
    console.log('   - GET /api/themes/featured?limit=6');
    console.log('   - GET /api/themes/trending?limit=8&period=week');

    // Colonnes nécessaires pour trending
    const trendingColumns = ['weekly_downloads', 'view_count', 'rating', 'download_count'];
    const missingTrending = trendingColumns.filter(c => !columnNames.includes(c));
    if (missingTrending.length > 0) {
      console.log(`\n⚠️  Colonnes manquantes pour trending: ${missingTrending.join(', ')}`);
    } else {
      console.log('\n✅ Toutes les colonnes pour trending sont présentes');
    }

    console.log('\n' + '='.repeat(80));
    console.log('FIN DE L\'ANALYSE');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkThemesLibrary();
