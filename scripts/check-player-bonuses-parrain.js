require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624'; // Serveur de test

async function check() {
  try {
    console.log('🔍 VÉRIFICATION DES DOUBLONS PARRAIN/MARRAINE DANS player_active_bonuses\n');
    console.log('='.repeat(80));

    // 1. Chercher toutes les entrées pour le bonus Parrain/Marraine
    console.log('\n📋 Entrées dans player_active_bonuses pour "Parrain/Marraine":\n');
    const parrainEntries = await db.queryAll(`
      SELECT
        pab.id,
        pab.user_id,
        pab.bonus_id,
        pab.is_active,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        pab.obtained_from,
        sb.name as bonus_name,
        sb.icon,
        p.username
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      WHERE pab.guild_id = $1
        AND sb.name ILIKE '%parrain%'
      ORDER BY pab.user_id, pab.id
    `, [GUILD_ID]);

    if (parrainEntries.length === 0) {
      console.log('⚠️  Aucune entrée trouvée pour "Parrain/Marraine"');
    } else {
      console.log(`Total: ${parrainEntries.length} entrée(s)\n`);
      console.table(parrainEntries.map(e => ({
        'ID PAB': e.id,
        'User': e.username || e.user_id,
        'Bonus': `${e.icon} ${e.bonus_name}`,
        'Actif': e.is_active ? '✅' : '❌',
        'Activé': e.activated_at ? new Date(e.activated_at).toLocaleString('fr-FR') : 'Non',
        'Source': e.obtained_from
      })));

      // 2. Détecter les doublons (même user_id + même bonus_id)
      console.log('\n🔍 ANALYSE DES DOUBLONS:\n');
      const userBonusCounts = {};
      parrainEntries.forEach(entry => {
        const key = `${entry.user_id}_${entry.bonus_id}`;
        if (!userBonusCounts[key]) {
          userBonusCounts[key] = [];
        }
        userBonusCounts[key].push(entry);
      });

      let duplicatesFound = false;
      Object.keys(userBonusCounts).forEach(key => {
        const entries = userBonusCounts[key];
        if (entries.length > 1) {
          duplicatesFound = true;
          console.log(`❌ DOUBLON DÉTECTÉ pour ${entries[0].username || entries[0].user_id}:`);
          console.log(`   - Bonus: ${entries[0].icon} ${entries[0].bonus_name}`);
          console.log(`   - Nombre d'entrées: ${entries.length}`);
          console.log(`   - IDs PAB: ${entries.map(e => e.id).join(', ')}\n`);
        }
      });

      if (!duplicatesFound) {
        console.log('✅ Aucun doublon détecté dans player_active_bonuses');
        console.log('💡 Le doublon est donc dans la logique d\'affichage de views/profileView.js\n');
      }
    }

    // 3. Vérifier aussi TOUS les bonus d'un utilisateur spécifique (si on veut)
    console.log('\n📊 VÉRIFICATION GLOBALE PAR UTILISATEUR:\n');
    const userGroups = {};
    parrainEntries.forEach(entry => {
      if (!userGroups[entry.user_id]) {
        userGroups[entry.user_id] = [];
      }
      userGroups[entry.user_id].push(entry);
    });

    Object.keys(userGroups).forEach(userId => {
      const entries = userGroups[userId];
      const username = entries[0].username || userId;
      console.log(`👤 ${username}:`);
      console.log(`   - ${entries.length} entrée(s) "Parrain/Marraine"`);
      entries.forEach(e => {
        console.log(`     • ID ${e.id}: ${e.is_active ? 'Actif' : 'Inactif'} - ${e.obtained_from}`);
      });
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('✅ Vérification terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
