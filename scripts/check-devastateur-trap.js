require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Vérifier sur les deux serveurs
const GUILD_IDS = ['1248028543389143070', '1182395170273099806'];

async function check() {
  try {
    for (const guildId of GUILD_IDS) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 Serveur: ${guildId}`);
      console.log('='.repeat(60));

      // Thème actif
      const theme = await pool.query(`
        SELECT t.id, t.name, t.guild_id
        FROM themes t
        WHERE t.guild_id = $1 AND t.is_active = TRUE
      `, [guildId]);

      if (theme.rows.length === 0) {
        console.log('❌ Aucun thème actif');
        continue;
      }

      const activeTheme = theme.rows[0];
      console.log(`\n📋 Thème actif: ${activeTheme.name} (ID: ${activeTheme.id})`);

      // Pièges du thème actif
      const traps = await pool.query(`
        SELECT id, name, type, description
        FROM traps
        WHERE theme_id = $1
        ORDER BY type
      `, [activeTheme.id]);

      console.log(`\n🪤 Pièges du thème (${traps.rows.length}):`);
      traps.rows.forEach(trap => {
        const isDevastateur = trap.type.includes('lose-all');
        console.log(`  ${isDevastateur ? '⚠️ ' : '  '}ID: ${trap.id} | Type: "${trap.type}" | Nom: ${trap.name}`);
      });

      // Vérifier spécifiquement le type lose-all
      const devastateur = traps.rows.find(t => t.type.includes('lose'));
      if (devastateur) {
        console.log(`\n🔍 Piège "lose" trouvé:`);
        console.log(`   Type exact: "${devastateur.type}"`);
        console.log(`   Attendu: "lose-all-collectibles" (avec 's')`);
        console.log(`   Match: ${devastateur.type === 'lose-all-collectibles' ? '✅ OK' : '❌ MISMATCH!'}`);
      }
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await pool.end();
    process.exit(1);
  }
}

check();
