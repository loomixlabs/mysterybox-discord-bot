require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    // Chercher tous les pièges avec un type contenant "lose-all" mais PAS "lose-all-collectibles"
    const wrongTraps = await pool.query(`
      SELECT t.id, t.name, t.type, t.description, th.name as theme_name, th.guild_id
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE t.type LIKE '%lose-all%' AND t.type != 'lose-all-collectibles'
    `);

    console.log('\n🔍 Pièges avec type "lose-all" incorrect:');
    if (wrongTraps.rows.length === 0) {
      console.log('   ✅ Aucun piège avec type incorrect trouvé');
    } else {
      wrongTraps.rows.forEach(trap => {
        console.log(`\n   ❌ ID: ${trap.id}`);
        console.log(`      Nom: ${trap.name}`);
        console.log(`      Type: "${trap.type}" (INCORRECT)`);
        console.log(`      Thème: ${trap.theme_name}`);
        console.log(`      Serveur: ${trap.guild_id}`);
      });
    }

    // Lister TOUS les types de pièges uniques
    const allTypes = await pool.query(`
      SELECT DISTINCT type, COUNT(*) as count
      FROM traps
      GROUP BY type
      ORDER BY type
    `);

    console.log('\n📋 Tous les types de pièges dans la base:');
    allTypes.rows.forEach(row => {
      const isCorrect = ['cooldown', 'lose-collectible', 'lose-all-collectibles', 'public-shame', 'empty-box'].includes(row.type);
      console.log(`   ${isCorrect ? '✅' : '❌'} "${row.type}" (${row.count} pièges)`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await pool.end();
    process.exit(1);
  }
}

check();
