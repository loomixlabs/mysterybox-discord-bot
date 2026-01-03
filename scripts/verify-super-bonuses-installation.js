const db = require('../utils/database-pg');

/**
 * Vérification finale de l'installation des super bonuses
 * S'assure que les 11 bonuses fixes sont bien installés sur toutes les guilds
 */
async function verifyInstallation() {
  console.log('\n🔍 VÉRIFICATION INSTALLATION SUPER BONUSES\n');
  console.log('='.repeat(120));

  try {
    // 1. Liste des 11 bonuses obligatoires
    const expectedBonuses = [
      { id: 'chance_devil', name: 'Chance du Diable', icon: '🎰' },
      { id: 'divine_vision', name: 'Vision Divine', icon: '👁️' },
      { id: 'legendary_magnet', name: 'Aimant à Légendaires', icon: '🧲' },
      { id: 'celebrity_aura', name: 'Aura de Célébrité', icon: '👑' },
      { id: 'trap_shield', name: 'Bouclier Anti-Piège', icon: '🛡️' },
      { id: 'collector_insurance', name: 'Assurance Collector', icon: '💎' },
      { id: 'cooldown_accelerator', name: 'Accélérateur de Cooldown', icon: '⚡' },
      { id: 'jackpot_x2', name: 'Jackpot x2', icon: '💵' },
      { id: 'trap_detector', name: 'Détecteur de Pièges', icon: '🔍' },
      { id: 'back_to_future', name: 'Retour dans le Futur', icon: '⏪' },
      { id: 'godparent', name: 'Parrain/Marraine', icon: '🤝' }
    ];

    console.log('\n📋 1. BONUSES ATTENDUS (11 au total)\n');
    expectedBonuses.forEach((bonus, index) => {
      console.log(`   ${index + 1}. ${bonus.icon} ${bonus.name} (${bonus.id})`);
    });

    // 2. Récupérer toutes les guilds UNIQUES
    const guilds = await db.queryAll(`
      SELECT DISTINCT guild_id
      FROM themes
      ORDER BY guild_id
    `);

    console.log(`\n\n📊 2. VÉRIFICATION PAR GUILD (${guilds.length} guild(s) trouvée(s))\n`);
    console.log('='.repeat(120));

    let totalOk = 0;
    let totalWarnings = 0;
    const detailedResults = [];

    for (const guild of guilds) {
      console.log(`\n🔍 Guild: ${guild.guild_id}`);
      console.log('-'.repeat(120));

      // Compter les bonuses installés
      const bonusCount = await db.queryOne(`
        SELECT COUNT(*) as count
        FROM super_bonuses
        WHERE guild_id = $1
      `, [guild.guild_id]);

      const count = parseInt(bonusCount.count);

      // Lister les bonuses installés
      const installedBonuses = await db.queryAll(`
        SELECT bonus_id, name, icon, effect_type
        FROM super_bonuses
        WHERE guild_id = $1
        ORDER BY bonus_id
      `, [guild.guild_id]);

      console.log(`\n📊 ${count}/11 bonuses installés:`);

      // Vérifier chaque bonus attendu
      const missingBonuses = [];
      const extraBonuses = [];

      for (const expected of expectedBonuses) {
        const found = installedBonuses.find(b => b.bonus_id === expected.id);
        if (found) {
          console.log(`   ✅ ${found.icon} ${found.name} (${found.effect_type})`);
        } else {
          console.log(`   ❌ ${expected.icon} ${expected.name} - MANQUANT`);
          missingBonuses.push(expected.name);
        }
      }

      // Détecter les bonuses en trop (doublons ou bonus non standard)
      for (const installed of installedBonuses) {
        const isExpected = expectedBonuses.some(e => e.id === installed.bonus_id);
        if (!isExpected) {
          console.log(`   ⚠️  ${installed.icon} ${installed.name} - BONUS NON STANDARD`);
          extraBonuses.push(installed.name);
        }
      }

      // Statut final de la guild
      let status;
      if (count === 11 && missingBonuses.length === 0) {
        status = '✅ OK';
        totalOk++;
      } else if (count > 11) {
        status = `⚠️  DOUBLONS (${count}/11)`;
        totalWarnings++;
      } else {
        status = `❌ INCOMPLET (${count}/11)`;
        totalWarnings++;
      }

      console.log(`\n   Statut: ${status}`);

      detailedResults.push({
        guild_id: guild.guild_id,
        count,
        status,
        missing: missingBonuses,
        extra: extraBonuses
      });
    }

    // 3. Vérifier la contrainte effect_type
    console.log('\n\n💎 3. VÉRIFICATION CONTRAINTE effect_type\n');
    console.log('='.repeat(120));

    const constraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_effect_type_check'
    `);

    if (constraint) {
      console.log('✅ Contrainte trouvée:');
      console.log(`   ${constraint.definition}`);

      if (constraint.definition.includes('reroll')) {
        console.log('\n✅ "reroll" est présent dans la contrainte');
      } else {
        console.log('\n❌ "reroll" est ABSENT de la contrainte (PROBLÈME)');
      }
    } else {
      console.log('❌ Contrainte introuvable');
    }

    // 4. Statistiques par effect_type
    console.log('\n\n📊 4. STATISTIQUES PAR effect_type\n');
    console.log('='.repeat(120));

    const stats = await db.queryAll(`
      SELECT effect_type, COUNT(*) as count
      FROM super_bonuses
      GROUP BY effect_type
      ORDER BY count DESC, effect_type
    `);

    console.log('\n✅ Répartition des effect_types:');
    console.table(stats);

    // 5. Résumé final
    console.log('\n\n📋 RÉSUMÉ FINAL\n');
    console.log('='.repeat(120));

    console.log(`\n✅ Guilds avec 11/11 bonuses: ${totalOk}`);
    console.log(`⚠️  Guilds avec problèmes: ${totalWarnings}`);

    if (totalWarnings > 0) {
      console.log('\n⚠️  DÉTAILS DES PROBLÈMES:\n');
      detailedResults
        .filter(r => r.status.includes('⚠️') || r.status.includes('❌'))
        .forEach(r => {
          console.log(`   Guild ${r.guild_id}: ${r.status}`);
          if (r.missing.length > 0) {
            console.log(`      Manquants: ${r.missing.join(', ')}`);
          }
          if (r.extra.length > 0) {
            console.log(`      En trop: ${r.extra.join(', ')}`);
          }
        });
    }

    console.log('\n' + '='.repeat(120));

    if (totalOk === guilds.length) {
      console.log('✅ Installation PARFAITE - Tous les serveurs ont les 11 bonuses\n');
      process.exit(0);
    } else {
      console.log('⚠️  Installation PARTIELLE - Certains serveurs ont des problèmes\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERREUR lors de la vérification:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyInstallation();
