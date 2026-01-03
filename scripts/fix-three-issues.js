/**
 * Script pour corriger 3 problèmes:
 * 1. Vérifier les cooldowns et les supprimer
 * 2. Vérifier la colonne trap_lose_all_collectibles dans announcement_settings
 * 3. Afficher le piège "Enchère Ratée" pour voir le shame_message
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const GUILD_ID = '1182395170273099806';

async function main() {
  const client = await pool.connect();

  try {
    console.log('=' .repeat(80));
    console.log('🔍 DIAGNOSTIC ET CORRECTIONS');
    console.log('=' .repeat(80));

    // 1. Vérifier et supprimer les cooldowns
    console.log('\n📋 1. COOLDOWNS ACTIFS:\n');

    const cooldowns = await client.query(`
      SELECT pc.*, p.username
      FROM player_cooldowns pc
      JOIN players p ON pc.player_id = p.id
      WHERE pc.guild_id = $1
    `, [GUILD_ID]);

    if (cooldowns.rows.length === 0) {
      console.log('   ✅ Aucun cooldown actif');
    } else {
      console.log(`   🔴 ${cooldowns.rows.length} cooldown(s) trouvé(s):`);
      cooldowns.rows.forEach(cd => {
        console.log(`      - Joueur: ${cd.username}, Trap ID: ${cd.trap_id}, Expire: ${cd.expires_at}`);
      });

      // Supprimer les cooldowns
      const deleted = await client.query(`
        DELETE FROM player_cooldowns WHERE guild_id = $1
        RETURNING *
      `, [GUILD_ID]);
      console.log(`\n   🗑️  ${deleted.rowCount} cooldown(s) supprimé(s)`);
    }

    // 2. Vérifier les colonnes trap dans announcement_settings
    console.log('\n📋 2. COLONNES TRAP DANS announcement_settings:\n');

    const columns = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      AND column_name LIKE '%trap%'
      ORDER BY column_name
    `);

    if (columns.rows.length === 0) {
      console.log('   ❌ Aucune colonne trap trouvée!');
    } else {
      console.log('   Colonnes existantes:');
      columns.rows.forEach(col => {
        console.log(`      - ${col.column_name} (${col.data_type})`);
      });
    }

    // Vérifier si trap_lose_all_collectibles existe
    const hasLoseAll = columns.rows.some(c => c.column_name === 'trap_lose_all_collectibles');
    if (!hasLoseAll) {
      console.log('\n   🔧 AJOUT de la colonne trap_lose_all_collectibles...');
      await client.query(`
        ALTER TABLE announcement_settings
        ADD COLUMN IF NOT EXISTS trap_lose_all_collectibles BOOLEAN DEFAULT TRUE
      `);
      console.log('   ✅ Colonne ajoutée!');
    }

    // 3. Vérifier les paramètres d'annonces pour ce serveur
    console.log('\n📋 3. PARAMÈTRES D\'ANNONCES DU SERVEUR:\n');

    const settings = await client.query(`
      SELECT trap_cooldown, trap_public_shame, trap_lose_collectible,
             trap_lose_all_collectibles, trap_empty_box, trap_curse, trap_malus_points
      FROM announcement_settings
      WHERE guild_id = $1
    `, [GUILD_ID]);

    if (settings.rows.length === 0) {
      console.log('   ❌ Aucun paramètre trouvé pour ce serveur');
    } else {
      console.log('   Paramètres actuels:');
      const s = settings.rows[0];
      console.log(`      - trap_cooldown: ${s.trap_cooldown}`);
      console.log(`      - trap_public_shame: ${s.trap_public_shame}`);
      console.log(`      - trap_lose_collectible: ${s.trap_lose_collectible}`);
      console.log(`      - trap_lose_all_collectibles: ${s.trap_lose_all_collectibles}`);
      console.log(`      - trap_empty_box: ${s.trap_empty_box}`);
      console.log(`      - trap_curse: ${s.trap_curse}`);
      console.log(`      - trap_malus_points: ${s.trap_malus_points}`);
    }

    // 4. Vérifier le piège "Enchère Ratée"
    console.log('\n📋 4. PIÈGE "ENCHÈRE RATÉE" (public-shame):\n');

    const trap = await client.query(`
      SELECT t.*, th.name as theme_name
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE t.guild_id = $1 AND t.type = 'public-shame'
    `, [GUILD_ID]);

    if (trap.rows.length === 0) {
      console.log('   ❌ Aucun piège public-shame trouvé');
    } else {
      trap.rows.forEach(t => {
        console.log(`   Piège: ${t.name} (Theme: ${t.theme_name})`);
        console.log(`   Type: ${t.type}`);
        console.log(`   Shame message: ${t.shame_message}`);
      });
    }

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Diagnostic terminé');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
