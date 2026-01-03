/**
 * Script de test pour l'Accélérateur de Cooldown
 * 1. Ajoute un cooldown au joueur (simule un piège)
 * 2. Donne l'Accélérateur de Cooldown au joueur
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070'; // Serveur de test
const DISCORD_ID = '692649463805640724'; // Ton Discord ID (à modifier si nécessaire)

async function main() {
  try {
    console.log('🔧 TEST ACCÉLÉRATEUR DE COOLDOWN\n');
    console.log('='.repeat(60));

    // 1. Récupérer le joueur
    console.log('\n📋 Récupération du joueur...');
    const player = await db.getPlayerByDiscordId(GUILD_ID, DISCORD_ID);

    if (!player) {
      console.log('❌ Joueur non trouvé. Crée ton profil avec /profile d\'abord.');
      process.exit(1);
    }
    console.log(`✅ Joueur trouvé: ${player.username} (ID: ${player.id})`);

    // 2. Vérifier les cooldowns actuels
    console.log('\n📋 Cooldowns actuels:');
    const currentCooldowns = await db.getActiveCooldowns(GUILD_ID, player.id);
    if (currentCooldowns.length === 0) {
      console.log('   Aucun cooldown actif');
    } else {
      currentCooldowns.forEach(cd => {
        console.log(`   - ${cd.trap_name || 'Piège inconnu'} (expire: ${cd.expires_at})`);
      });
    }

    // 3. Récupérer un piège de type cooldown
    console.log('\n📋 Recherche d\'un piège de type cooldown...');
    const trap = await db.queryOne(`
      SELECT * FROM traps
      WHERE guild_id = $1 AND type = 'cooldown' AND is_active = true
      LIMIT 1
    `, [GUILD_ID]);

    if (!trap) {
      console.log('⚠️  Aucun piège de type cooldown trouvé. Création d\'un cooldown manuel...');
      // Créer un cooldown de 30 minutes sans piège associé
      await db.query(`
        INSERT INTO player_cooldowns (guild_id, player_id, trap_id, expires_at, is_active)
        VALUES ($1, $2, NULL, NOW() + INTERVAL '30 minutes', TRUE)
      `, [GUILD_ID, player.id]);
      console.log('✅ Cooldown de 30 minutes ajouté !');
    } else {
      console.log(`✅ Piège trouvé: ${trap.name} (durée: ${trap.cooldown_duration} min)`);

      // 4. Ajouter un cooldown au joueur
      console.log('\n📋 Ajout du cooldown au joueur...');
      await db.addCooldown(GUILD_ID, player.id, trap.id, trap.cooldown_duration);
      console.log(`✅ Cooldown de ${trap.cooldown_duration} minutes ajouté !`);
    }

    // 5. Vérifier le super bonus "Accélérateur de Cooldown"
    console.log('\n📋 Recherche du super bonus Accélérateur de Cooldown...');
    const acceleratorBonus = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE effect_type = 'cooldown'
      LIMIT 1
    `, []);

    if (!acceleratorBonus) {
      console.log('❌ Super bonus "Accélérateur de Cooldown" non trouvé dans la DB');
      process.exit(1);
    }
    console.log(`✅ Bonus trouvé: ${acceleratorBonus.name} (ID: ${acceleratorBonus.id})`);

    // 6. Vérifier si le joueur a déjà ce bonus
    console.log('\n📋 Vérification des bonus actifs du joueur...');
    const existingBonus = await db.queryOne(`
      SELECT * FROM player_active_bonuses
      WHERE guild_id = $1 AND user_id = $2 AND bonus_id = $3 AND is_active = true
    `, [GUILD_ID, DISCORD_ID, acceleratorBonus.id]);

    if (existingBonus) {
      console.log(`⚠️  Le joueur a déjà ce bonus (charges: ${existingBonus.remaining_charges})`);
    } else {
      // 7. Donner le bonus au joueur
      console.log('\n📋 Attribution du bonus au joueur...');
      await db.query(`
        INSERT INTO player_active_bonuses
        (guild_id, user_id, bonus_id, is_active, remaining_charges, activated_at)
        VALUES ($1, $2, $3, TRUE, $4, NULL)
      `, [GUILD_ID, DISCORD_ID, acceleratorBonus.id, acceleratorBonus.duration_value || 1]);
      console.log(`✅ Bonus "${acceleratorBonus.name}" attribué avec ${acceleratorBonus.duration_value || 1} charge(s) !`);
    }

    // 8. Afficher le résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DU TEST');
    console.log('='.repeat(60));

    const finalCooldowns = await db.getActiveCooldowns(GUILD_ID, player.id);
    console.log(`\n⏰ Cooldowns actifs: ${finalCooldowns.length}`);
    finalCooldowns.forEach(cd => {
      const expiresAt = new Date(cd.expires_at);
      const minutesLeft = Math.ceil((expiresAt - Date.now()) / 60000);
      console.log(`   - ${cd.trap_name || 'Cooldown manuel'} (${minutesLeft} min restantes)`);
    });

    const finalBonuses = await db.queryAll(`
      SELECT pab.*, sb.name, sb.icon, sb.effect_type
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.user_id = $2 AND pab.is_active = true
      AND sb.effect_type = 'cooldown'
    `, [GUILD_ID, DISCORD_ID]);

    console.log(`\n⚡ Accélérateurs disponibles: ${finalBonuses.length}`);
    finalBonuses.forEach(b => {
      console.log(`   - ${b.icon || '⚡'} ${b.name} (${b.remaining_charges} charge(s))`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ PRÊT POUR LE TEST !');
    console.log('='.repeat(60));
    console.log('\n📌 Instructions:');
    console.log('   1. Va sur Discord');
    console.log('   2. Tape /profile');
    console.log('   3. Clique sur "Mes Bonus" 💫');
    console.log('   4. Tu devrais voir l\'Accélérateur de Cooldown');
    console.log('   5. Clique sur "Activer" pour supprimer ton cooldown !');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
