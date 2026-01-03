const db = require('../utils/database-pg');

/**
 * Script de setup pour Aimant à Légendaires et Jackpot x2
 *
 * Ce script :
 * 1. Vérifie l'existence des deux bonus dans super_bonuses
 * 2. Crée ou met à jour leur configuration
 * 3. Vérifie qu'ils sont disponibles pour tous les guildes actifs
 */

async function setupAimantJackpotBonuses() {
  try {
    console.log('🔧 SETUP - Aimant à Légendaires & Jackpot x2\n');
    console.log('='.repeat(80));

    // Récupérer tous les guildes actifs
    const guilds = await db.query('SELECT DISTINCT guild_id FROM themes');
    console.log(`\n📊 ${guilds.length} serveur(s) détecté(s)\n`);

    for (const guild of guilds) {
      const guildId = guild.guild_id;
      console.log(`\n🔹 Traitement du serveur: ${guildId}`);
      console.log('-'.repeat(80));

      // ==========================================
      // 1. AIMANT À LÉGENDAIRES
      // ==========================================
      console.log('\n🧲 AIMANT À LÉGENDAIRES:');

      // Vérifier si le bonus existe déjà
      let aimant = await db.queryOne(`
        SELECT * FROM super_bonuses
        WHERE guild_id = $1
        AND (name ILIKE '%aimant%' OR effect_type = 'rarity_boost')
      `, [guildId]);

      if (aimant) {
        console.log(`   ✅ Existe déjà (ID: ${aimant.id})`);
        console.log(`      Nom: ${aimant.name}`);
        console.log(`      Config: ${JSON.stringify(aimant.effect_config, null, 2)}`);

        // Vérifier si la config est correcte
        const correctConfig = {
          target_rarity: 'legendary',
          boost_percentage: 50
        };

        if (JSON.stringify(aimant.effect_config) !== JSON.stringify(correctConfig)) {
          console.log(`   ⚠️  Configuration incorrecte - Mise à jour...`);
          await db.query(`
            UPDATE super_bonuses
            SET effect_config = $1,
                effect_type = 'rarity_boost',
                bonus_type = 'collectible',
                name = '🧲 Aimant à Légendaires',
                description = 'Augmente les chances d''obtenir des collectibles légendaires de 50% pendant une durée limitée.',
                icon = '🧲'
            WHERE id = $2 AND guild_id = $3
          `, [JSON.stringify(correctConfig), aimant.id, guildId]);
          console.log(`   ✅ Configuration mise à jour`);
        } else {
          console.log(`   ✅ Configuration correcte`);
        }
      } else {
        console.log(`   ❌ N'existe pas - Création...`);
        const result = await db.query(`
          INSERT INTO super_bonuses (
            guild_id,
            name,
            description,
            icon,
            bonus_type,
            effect_type,
            effect_config,
            rarity,
            probability,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING id
        `, [
          guildId,
          '🧲 Aimant à Légendaires',
          'Augmente les chances d\'obtenir des collectibles légendaires de 50% pendant une durée limitée.',
          '🧲',
          'collectible',
          'rarity_boost',
          JSON.stringify({
            target_rarity: 'legendary',
            boost_percentage: 50
          }),
          'legendary',
          0.02 // 2% de probabilité d'apparition
        ]);
        console.log(`   ✅ Créé avec succès (ID: ${result[0].id})`);
      }

      // ==========================================
      // 2. JACKPOT X2
      // ==========================================
      console.log('\n💰 JACKPOT X2:');

      // Vérifier si le bonus existe déjà
      let jackpot = await db.queryOne(`
        SELECT * FROM super_bonuses
        WHERE guild_id = $1
        AND (name ILIKE '%jackpot%' OR (effect_type = 'multiplier' AND effect_config->>'applies_to' = 'collectible'))
      `, [guildId]);

      if (jackpot) {
        console.log(`   ✅ Existe déjà (ID: ${jackpot.id})`);
        console.log(`      Nom: ${jackpot.name}`);
        console.log(`      Config: ${JSON.stringify(jackpot.effect_config, null, 2)}`);

        // Vérifier si la config est correcte
        const correctConfig = {
          applies_to: 'collectible',
          multiplier: 2
        };

        if (JSON.stringify(jackpot.effect_config) !== JSON.stringify(correctConfig)) {
          console.log(`   ⚠️  Configuration incorrecte - Mise à jour...`);
          await db.query(`
            UPDATE super_bonuses
            SET effect_config = $1,
                effect_type = 'multiplier',
                bonus_type = 'collectible',
                name = '💰 Jackpot x2',
                description = 'Chaque collectible obtenu donne un second collectible bonus aléatoire. Consomme 1 charge par utilisation.',
                icon = '💰'
            WHERE id = $2 AND guild_id = $3
          `, [JSON.stringify(correctConfig), jackpot.id, guildId]);
          console.log(`   ✅ Configuration mise à jour`);
        } else {
          console.log(`   ✅ Configuration correcte`);
        }
      } else {
        console.log(`   ❌ N'existe pas - Création...`);
        const result = await db.query(`
          INSERT INTO super_bonuses (
            guild_id,
            name,
            description,
            icon,
            bonus_type,
            effect_type,
            effect_config,
            rarity,
            probability,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING id
        `, [
          guildId,
          '💰 Jackpot x2',
          'Chaque collectible obtenu donne un second collectible bonus aléatoire. Consomme 1 charge par utilisation.',
          '💰',
          'collectible',
          'multiplier',
          JSON.stringify({
            applies_to: 'collectible',
            multiplier: 2
          }),
          'epic',
          0.05 // 5% de probabilité d'apparition
        ]);
        console.log(`   ✅ Créé avec succès (ID: ${result[0].id})`);
      }
    }

    // ==========================================
    // RÉSUMÉ FINAL
    // ==========================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ FINAL\n');

    for (const guild of guilds) {
      const guildId = guild.guild_id;
      console.log(`\n🔹 Serveur ${guildId}:`);

      const bonuses = await db.query(`
        SELECT id, name, effect_type, rarity
        FROM super_bonuses
        WHERE guild_id = $1
        AND effect_type IN ('rarity_boost', 'multiplier')
        ORDER BY name
      `, [guildId]);

      bonuses.forEach(bonus => {
        console.log(`   ${bonus.effect_type === 'rarity_boost' ? '🧲' : '💰'} [ID ${bonus.id}] ${bonus.name} (${bonus.rarity})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Setup terminé avec succès !\n');

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

setupAimantJackpotBonuses();
