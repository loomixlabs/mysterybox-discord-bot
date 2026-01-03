const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function check() {
  try {
    console.log('🔍 Vérification badges Mystery Box\n');
    console.log('═'.repeat(80));

    // Vérifier les badges mystery_box
    const mysteryBoxBadges = await pool.query(`
      SELECT code, name, emoji, rarity, category, condition_value
      FROM badges
      WHERE category = 'mystery_box'
      ORDER BY condition_value ASC
    `);

    console.log(`\n✅ Badges avec category = 'mystery_box': ${mysteryBoxBadges.rows.length}`);
    if (mysteryBoxBadges.rows.length > 0) {
      console.table(mysteryBoxBadges.rows);
    }

    // Vérifier si les codes existent dans une autre catégorie
    const codes = ['MYSTERY_CHANCEUX', 'MYSTERY_CHASSEUR', 'MYSTERY_MAITRE', 'MYSTERY_LEGENDE'];
    console.log('\n🔍 Recherche des codes MYSTERY_* dans toutes les catégories:\n');

    for (const code of codes) {
      const badge = await pool.query('SELECT * FROM badges WHERE code = $1', [code]);
      if (badge.rows.length > 0) {
        console.log(`   ✅ ${code}: ${badge.rows[0].name} (${badge.rows[0].category})`);
      } else {
        console.log(`   ❌ ${code}: Non trouvé`);
      }
    }

    // Compter tous les badges
    const total = await pool.query('SELECT COUNT(*) as count FROM badges');
    console.log(`\n📊 Total badges en base: ${total.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

check();
