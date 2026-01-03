/**
 * Script pour vérifier les tables existantes pour le Theme Builder
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'botuser',
  host: 'localhost',
  database: 'botdb',
  password: 'Discord2025IA@Bot',
  port: 5432
});

async function check() {
  const client = await pool.connect();

  try {
    console.log('='.repeat(60));
    console.log('VÉRIFICATION DES TABLES POUR THEME BUILDER');
    console.log('='.repeat(60));

    // 1. Check super_admins
    console.log('\n📋 TABLE: super_admins');
    const superAdminsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_admins'
      ORDER BY ordinal_position
    `);

    if (superAdminsResult.rows.length === 0) {
      console.log('  ❌ Table super_admins NON TROUVÉE');
    } else {
      console.table(superAdminsResult.rows);
    }

    // 2. Check guild_config
    console.log('\n📋 TABLE: guild_config');
    const guildConfigResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'guild_config'
      ORDER BY ordinal_position
    `);

    if (guildConfigResult.rows.length === 0) {
      console.log('  ❌ Table guild_config NON TROUVÉE');
    } else {
      console.table(guildConfigResult.rows);

      // Check premium field
      const hasPremium = guildConfigResult.rows.some(c => c.column_name.includes('premium'));
      console.log('\n  🔍 Champ premium existe:', hasPremium ? '✅ OUI' : '❌ NON');
    }

    // 3. List super admins
    console.log('\n👑 SUPER ADMINS EXISTANTS:');
    try {
      const admins = await client.query('SELECT * FROM super_admins LIMIT 10');
      if (admins.rows.length === 0) {
        console.log('  Aucun super admin trouvé');
      } else {
        console.table(admins.rows);
      }
    } catch(e) {
      console.log('  ❌ Erreur:', e.message);
    }

    // 4. Check themes table exists
    console.log('\n📋 TABLE: themes');
    const themesResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'themes'
      ORDER BY ordinal_position
    `);

    if (themesResult.rows.length === 0) {
      console.log('  ❌ Table themes NON TROUVÉE');
    } else {
      console.table(themesResult.rows);
    }

    // 5. Check if themes_library exists (new table we'll create)
    console.log('\n📋 TABLE: themes_library (nouvelle table à créer)');
    const themesLibraryResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'themes_library'
    `);

    if (themesLibraryResult.rows.length === 0) {
      console.log('  ⚠️ Table themes_library N\'EXISTE PAS ENCORE (à créer)');
    } else {
      console.table(themesLibraryResult.rows);
    }

    console.log('\n' + '='.repeat(60));
    console.log('FIN DE LA VÉRIFICATION');
    console.log('='.repeat(60));

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
