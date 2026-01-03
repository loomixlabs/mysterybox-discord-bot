/**
 * Script de vérification finale après restauration VPS
 */
const db = require('../utils/database-pg');

const TEST_GUILD_ID = '297309737135898624';
const PROD_GUILD_ID = '1182395170273099806';

async function createMissingThemeBuilderTables() {
  console.log('🔧 Création des tables Theme Builder manquantes...\n');

  // banned_builder_users
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.banned_builder_users (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255),
        reason TEXT,
        banned_by VARCHAR(255),
        banned_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `);
    console.log('   ✅ banned_builder_users créée');
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.log('   ⚠️  banned_builder_users:', err.message);
    }
  }

  // themes_library
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.themes_library (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        author_id VARCHAR(255),
        author_username VARCHAR(255),
        parent_theme_id INTEGER,
        is_public BOOLEAN DEFAULT FALSE,
        is_official BOOLEAN DEFAULT FALSE,
        download_count INTEGER DEFAULT 0,
        rating NUMERIC(3,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ themes_library créée');
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.log('   ⚠️  themes_library:', err.message);
    }
  }
}

async function main() {
  try {
    console.log('📊 VÉRIFICATION FINALE DE LA RESTAURATION\n');
    console.log('='.repeat(80));

    // Créer les tables manquantes d'abord
    await createMissingThemeBuilderTables();

    // 1. Compter les tables
    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`\n📋 TABLES: ${tables.length}`);

    // Catégoriser les tables
    const themeBuilderTables = tables.filter(t =>
      t.table_name.includes('theme_builder') ||
      t.table_name === 'themes_library' ||
      t.table_name === 'banned_builder_users'
    );
    const botTables = tables.filter(t =>
      !t.table_name.includes('theme_builder') &&
      t.table_name !== 'themes_library' &&
      t.table_name !== 'banned_builder_users'
    );

    console.log(`   - Tables Bot: ${botTables.length}`);
    console.log(`   - Tables Theme Builder: ${themeBuilderTables.length}`);

    // 2. Vérifier les tables Theme Builder
    console.log('\n🎨 TABLES THEME BUILDER:');
    for (const t of themeBuilderTables) {
      try {
        const result = await db.queryOne(`SELECT COUNT(*) as count FROM "${t.table_name}"`);
        console.log(`   ✅ ${t.table_name}: ${result.count} lignes`);
      } catch (err) {
        console.log(`   ❌ ${t.table_name}: ${err.message}`);
      }
    }

    // 3. Vérifier les données du bot
    console.log('\n🤖 DONNÉES BOT PRINCIPALES:');

    const checks = [
      { query: 'SELECT COUNT(*) as count FROM themes', label: 'Thèmes' },
      { query: 'SELECT COUNT(*) as count FROM missions', label: 'Missions' },
      { query: 'SELECT COUNT(*) as count FROM quiz_questions', label: 'Quiz Questions' },
      { query: 'SELECT COUNT(*) as count FROM collectibles', label: 'Collectibles' },
      { query: 'SELECT COUNT(*) as count FROM traps', label: 'Pièges' },
      { query: 'SELECT COUNT(*) as count FROM players', label: 'Joueurs' },
      { query: 'SELECT COUNT(*) as count FROM collections', label: 'Collections' },
      { query: 'SELECT COUNT(*) as count FROM super_bonuses', label: 'Super Bonus' },
      { query: 'SELECT COUNT(*) as count FROM badges', label: 'Badges' }
    ];

    for (const check of checks) {
      try {
        const result = await db.queryOne(check.query);
        console.log(`   ✅ ${check.label}: ${result.count}`);
      } catch (err) {
        console.log(`   ❌ ${check.label}: ${err.message}`);
      }
    }

    // 4. Vérifier les données par serveur
    console.log('\n📊 PAR SERVEUR:');

    // Production
    const prodStats = await db.queryOne(`
      SELECT
        (SELECT COUNT(*) FROM themes WHERE guild_id = $1) as themes,
        (SELECT COUNT(*) FROM players WHERE guild_id = $1) as players,
        (SELECT COUNT(*) FROM missions WHERE guild_id = $1) as missions
    `, [PROD_GUILD_ID]);
    console.log(`   🏭 Production (${PROD_GUILD_ID}):`);
    console.log(`      - Thèmes: ${prodStats.themes}`);
    console.log(`      - Joueurs: ${prodStats.players}`);
    console.log(`      - Missions: ${prodStats.missions}`);

    // Test
    const testStats = await db.queryOne(`
      SELECT
        (SELECT COUNT(*) FROM themes WHERE guild_id = $1) as themes,
        (SELECT COUNT(*) FROM players WHERE guild_id = $1) as players,
        (SELECT COUNT(*) FROM missions WHERE guild_id = $1) as missions
    `, [TEST_GUILD_ID]);
    console.log(`   🧪 Test (${TEST_GUILD_ID}):`);
    console.log(`      - Thèmes: ${testStats.themes}`);
    console.log(`      - Joueurs: ${testStats.players}`);
    console.log(`      - Missions: ${testStats.missions}`);

    // 5. Vérifier le thème Harry Potter
    console.log('\n🧙 THÈME HARRY POTTER (Test):');
    const harryPotter = await db.queryOne(`
      SELECT id, name, is_active FROM themes
      WHERE guild_id = $1 AND name ILIKE '%harry%potter%'
    `, [TEST_GUILD_ID]);

    if (harryPotter) {
      console.log(`   ✅ Trouvé: ${harryPotter.name} (ID: ${harryPotter.id})`);

      const missions = await db.queryAll(`
        SELECT m.id, m.name, m.type,
          (SELECT COUNT(*) FROM quiz_questions q WHERE q.mission_id = m.id) as questions
        FROM missions m
        WHERE m.theme_id = $1
        ORDER BY m.id
      `, [harryPotter.id]);

      console.log(`   📋 Missions: ${missions.length}`);
      missions.forEach(m => {
        console.log(`      - ${m.name} (${m.type}): ${m.questions} questions`);
      });

      const totalQuestions = missions.reduce((sum, m) => sum + parseInt(m.questions || 0), 0);
      console.log(`   ❓ Total questions: ${totalQuestions}`);

      if (missions.length >= 7 && totalQuestions >= 16) {
        console.log('   ✅ Thème Harry Potter correctement restauré!');
      } else {
        console.log('   ⚠️  Données incomplètes');
      }
    } else {
      console.log('   ⚠️  Thème Harry Potter non trouvé');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ VÉRIFICATION TERMINÉE!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
