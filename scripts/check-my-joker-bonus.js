/**
 * Script pour vérifier le bonus Joker attribué aux gagnants du mini-jeu
 * et diagnostiquer pourquoi l'utilisateur ne voit pas son bonus
 */

require('dotenv').config();

const CONFIG = {
  GUILD_ID: '1182395170273099806',
  JOKER_BONUS_ID: 123
};

// Connexion DB VPS
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: process.env.DB_PORT || process.env.POSTGRES_PORT || 5432,
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'botdb',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'botuser',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function investigate() {
  console.log('='.repeat(70));
  console.log('🔍 DIAGNOSTIC BONUS JOKER - Mini-jeu Vif d\'Or');
  console.log('='.repeat(70));
  console.log(`\n📍 Guild ID: ${CONFIG.GUILD_ID}`);
  console.log(`📍 Bonus ID Joker: ${CONFIG.JOKER_BONUS_ID}\n`);

  // 1. Vérifier les gagnants du mini-jeu
  console.log('📋 1. GAGNANTS DU MINI-JEU (apple_game_winners):');
  console.log('-'.repeat(50));
  const winners = await query(`
    SELECT id, user_id, won_at
    FROM apple_game_winners
    WHERE guild_id = $1
    ORDER BY won_at ASC
  `, [CONFIG.GUILD_ID]);

  if (winners.length === 0) {
    console.log('   ⚠️ Aucun gagnant trouvé!');
  } else {
    winners.forEach((w, i) => {
      console.log(`   ${i+1}. User ID: ${w.user_id} | Gagné le: ${w.won_at}`);
    });
    console.log(`\n   Total: ${winners.length} gagnant(s)`);
  }

  // 2. Vérifier les bonus attribués avec source 'mini_game_reward'
  console.log('\n📋 2. BONUS ATTRIBUÉS (player_active_bonuses avec source mini_game_reward):');
  console.log('-'.repeat(50));
  const bonuses = await query(`
    SELECT id, user_id, bonus_id, is_active, remaining_charges, obtained_from, created_at
    FROM player_active_bonuses
    WHERE guild_id = $1
    AND obtained_from = 'mini_game_reward'
    ORDER BY created_at ASC
  `, [CONFIG.GUILD_ID]);

  if (bonuses.length === 0) {
    console.log('   ⚠️ Aucun bonus mini_game_reward trouvé!');
  } else {
    bonuses.forEach((b, i) => {
      console.log(`   ${i+1}. ID: ${b.id} | User: ${b.user_id} | Bonus: ${b.bonus_id} | Active: ${b.is_active} | Charges: ${b.remaining_charges}`);
    });
    console.log(`\n   Total: ${bonuses.length} bonus attribué(s)`);
  }

  // 3. Vérifier TOUS les bonus Joker (ID 123) pour ce serveur
  console.log('\n📋 3. TOUS LES BONUS JOKER (ID 123) POUR CE SERVEUR:');
  console.log('-'.repeat(50));
  const allJokers = await query(`
    SELECT id, user_id, bonus_id, is_active, remaining_charges, obtained_from, created_at
    FROM player_active_bonuses
    WHERE guild_id = $1
    AND bonus_id = $2
    ORDER BY created_at ASC
  `, [CONFIG.GUILD_ID, CONFIG.JOKER_BONUS_ID]);

  if (allJokers.length === 0) {
    console.log('   ⚠️ Aucun bonus Joker (ID 123) trouvé pour ce serveur!');
  } else {
    allJokers.forEach((b, i) => {
      console.log(`   ${i+1}. ID: ${b.id} | User: ${b.user_id} | Active: ${b.is_active} | Charges: ${b.remaining_charges} | Source: ${b.obtained_from}`);
    });
    console.log(`\n   Total: ${allJokers.length} Joker(s)`);
  }

  // 4. Vérifier si le super_bonus ID 123 existe dans la table super_bonuses
  console.log('\n📋 4. VÉRIFICATION SUPER_BONUS ID 123:');
  console.log('-'.repeat(50));
  const superBonus = await query(`
    SELECT id, name, description, effect_type, rarity, is_active
    FROM super_bonuses
    WHERE id = $1
  `, [CONFIG.JOKER_BONUS_ID]);

  if (superBonus.length === 0) {
    console.log('   ❌ ERREUR: Le super_bonus ID 123 n\'existe pas dans la table super_bonuses!');
    console.log('   C\'est probablement la raison pour laquelle tu ne vois pas le bonus.');
  } else {
    const sb = superBonus[0];
    console.log(`   ✅ Super Bonus trouvé:`);
    console.log(`      - ID: ${sb.id}`);
    console.log(`      - Nom: ${sb.name}`);
    console.log(`      - Type: ${sb.effect_type}`);
    console.log(`      - Rareté: ${sb.rarity}`);
    console.log(`      - Actif: ${sb.is_active}`);
  }

  // 5. Lister TOUS les super_bonuses disponibles pour ce serveur
  console.log('\n📋 5. LISTE DE TOUS LES SUPER_BONUSES DISPONIBLES:');
  console.log('-'.repeat(50));
  const allBonuses = await query(`
    SELECT id, name, effect_type, rarity
    FROM super_bonuses
    WHERE guild_id = $1 OR guild_id IS NULL
    ORDER BY id ASC
  `, [CONFIG.GUILD_ID]);

  if (allBonuses.length === 0) {
    console.log('   ⚠️ Aucun super_bonus trouvé!');
  } else {
    allBonuses.forEach(b => {
      const marker = b.id === CONFIG.JOKER_BONUS_ID ? ' ← JOKER' : '';
      console.log(`   ID ${b.id}: ${b.name} (${b.rarity})${marker}`);
    });
    console.log(`\n   Total: ${allBonuses.length} super_bonus`);
  }

  // 6. Chercher le Joker par nom
  console.log('\n📋 6. RECHERCHE DU JOKER PAR NOM:');
  console.log('-'.repeat(50));
  const jokerByName = await query(`
    SELECT id, name, description, effect_type, rarity, guild_id
    FROM super_bonuses
    WHERE LOWER(name) LIKE '%joker%'
    OR LOWER(effect_type) LIKE '%joker%'
  `);

  if (jokerByName.length === 0) {
    console.log('   ⚠️ Aucun bonus avec "joker" dans le nom ou effect_type!');
  } else {
    jokerByName.forEach(b => {
      console.log(`   ID ${b.id}: ${b.name} | Type: ${b.effect_type} | Guild: ${b.guild_id || 'global'}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Diagnostic terminé');
  console.log('='.repeat(70));
}

investigate()
  .then(() => pool.end())
  .catch(e => {
    console.error('❌ Erreur:', e);
    pool.end();
    process.exit(1);
  });
