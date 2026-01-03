const db = require('../utils/database-pg');

async function verifyVisionDivineFixes() {
  try {
    const guildId = '297309737135898624'; // Serveur de test
    const userId = '297307186307006464'; // xmicordix

    console.log('🔍 VÉRIFICATION COMPLÈTE - VISION DIVINE\n');
    console.log('='.repeat(80));

    // 1. Vérifier la contrainte bonus_type
    console.log('\n📋 1. CONTRAINTE bonus_type:');
    console.log('-'.repeat(80));
    const constraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_bonus_type_check'
    `);

    console.log(`   ${constraint.definition}`);
    const hasReveal = constraint.definition.includes("'reveal'");
    console.log(`   ${hasReveal ? '✅' : '❌'} Type "reveal" autorisé: ${hasReveal}\n`);

    // 2. Vérifier Vision Divine dans super_bonuses
    console.log('\n📋 2. VISION DIVINE - super_bonuses:');
    console.log('-'.repeat(80));
    const visionDivine = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    if (!visionDivine) {
      console.log('   ❌ Vision Divine introuvable!\n');
      process.exit(1);
    }

    console.log(`   ID: ${visionDivine.id}`);
    console.log(`   Name: ${visionDivine.name}`);
    console.log(`   ${visionDivine.bonus_type === 'reveal' ? '✅' : '❌'} bonus_type: ${visionDivine.bonus_type} ${visionDivine.bonus_type === 'reveal' ? '' : '(DEVRAIT ÊTRE "reveal")'}`);
    console.log(`   ${visionDivine.effect_type === 'reveal' ? '✅' : '❌'} effect_type: ${visionDivine.effect_type}`);
    console.log(`   Uses charges: ${visionDivine.uses_charges}`);
    console.log(`   Max charges: ${visionDivine.max_charges}\n`);

    // 3. Vérifier le player
    console.log('\n📋 3. JOUEUR:');
    console.log('-'.repeat(80));
    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, userId]);

    if (!player) {
      console.log('   ❌ Joueur introuvable!\n');
      process.exit(1);
    }

    console.log(`   ✅ ${player.username} (ID: ${player.id})\n`);

    // 4. Vérifier player_active_bonuses
    console.log('\n📋 4. BONUS ACTIFS - player_active_bonuses:');
    console.log('-'.repeat(80));
    const activeBonus = await db.query(`
      SELECT pab.*, sb.name, sb.bonus_type, sb.effect_type
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.user_id = $2
      ORDER BY pab.activated_at DESC
    `, [guildId, userId]);

    console.log(`   Total: ${activeBonus.length} bonus actif(s)\n`);

    if (activeBonus.length === 0) {
      console.log('   ⚠️  Aucun bonus actif pour ce joueur\n');
    } else {
      const now = new Date();
      activeBonus.forEach((bonus, i) => {
        console.log(`   ${i + 1}. ${bonus.name} (ID: ${bonus.id})`);
        console.log(`      bonus_id: ${bonus.bonus_id}`);
        console.log(`      bonus_type: ${bonus.bonus_type}`);
        console.log(`      effect_type: ${bonus.effect_type}`);
        console.log(`      remaining_charges: ${bonus.remaining_charges}`);
        console.log(`      is_active: ${bonus.is_active}`);

        if (bonus.expires_at) {
          const expiresAt = new Date(bonus.expires_at);
          const isExpired = expiresAt <= now;
          console.log(`      expires_at: ${expiresAt.toLocaleString('fr-FR')} ${isExpired ? '❌ EXPIRÉ' : '✅ ACTIF'}`);
        } else {
          console.log(`      expires_at: NULL (permanent jusqu'à épuisement)`);
        }

        // Vérifier si ce bonus serait détecté par hasRevealBonus
        const wouldBeDetected =
          bonus.bonus_type === 'reveal' &&
          bonus.is_active &&
          bonus.remaining_charges > 0 &&
          (!bonus.expires_at || new Date(bonus.expires_at) > now);

        console.log(`      ${wouldBeDetected ? '✅' : '❌'} Serait détecté par hasRevealBonus: ${wouldBeDetected}\n`);
      });
    }

    // 5. Test de la requête exacte utilisée par mysteryBoxHandler
    console.log('\n📋 5. TEST REQUÊTE checkAndRevealVisionDivine:');
    console.log('-'.repeat(80));
    const revealBonus = await db.queryOne(`
      SELECT pab.*, sb.name, sb.bonus_type, sb.effect_type
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.user_id = $1
      AND pab.guild_id = $2
      AND sb.bonus_type = 'reveal'
      AND pab.is_active = TRUE
      AND (pab.expires_at IS NULL OR pab.expires_at > NOW())
      AND pab.remaining_charges > 0
      LIMIT 1
    `, [userId, guildId]);

    if (!revealBonus) {
      console.log('   ❌ Aucun bonus de révélation actif trouvé!\n');
      console.log('   Raisons possibles:');
      console.log('   - Pas de Vision Divine active pour ce joueur');
      console.log('   - remaining_charges = 0');
      console.log('   - is_active = FALSE');
      console.log('   - bonus_type != "reveal"\n');
    } else {
      console.log('   ✅ Bonus de révélation trouvé!');
      console.log(`   ID: ${revealBonus.id}`);
      console.log(`   Name: ${revealBonus.name}`);
      console.log(`   bonus_type: ${revealBonus.bonus_type}`);
      console.log(`   effect_type: ${revealBonus.effect_type}`);
      console.log(`   remaining_charges: ${revealBonus.remaining_charges}\n`);
    }

    // 6. Résumé final
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ FINAL:\n');

    const checks = [
      { name: 'Contrainte autorise "reveal"', passed: hasReveal },
      { name: 'Vision Divine existe', passed: !!visionDivine },
      { name: 'bonus_type = "reveal"', passed: visionDivine?.bonus_type === 'reveal' },
      { name: 'effect_type = "reveal"', passed: visionDivine?.effect_type === 'reveal' },
      { name: 'Joueur existe', passed: !!player },
      { name: 'A des bonus actifs', passed: activeBonus.length > 0 },
      { name: 'Bonus détectable par hasRevealBonus', passed: !!revealBonus }
    ];

    checks.forEach(check => {
      console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}`);
    });

    const allPassed = checks.every(c => c.passed);
    console.log(`\n${allPassed ? '✅' : '❌'} ${allPassed ? 'TOUS LES CHECKS PASSENT!' : 'CERTAINS CHECKS ÉCHOUENT'}\n`);

    if (!allPassed) {
      console.log('⚠️  Vision Divine pourrait ne pas fonctionner correctement.\n');

      // Suggestions
      if (!revealBonus && player) {
        console.log('💡 SUGGESTIONS:');
        console.log('   - Le joueur doit activer une Vision Divine via /my-bonuses');
        console.log('   - Vérifier que remaining_charges > 0');
        console.log('   - Vérifier que is_active = TRUE\n');
      }
    } else {
      console.log('✅ Vision Divine devrait fonctionner correctement!\n');
      console.log('📝 POUR TESTER:');
      console.log('   1. Utilisez /open-box sur Discord');
      console.log('   2. Vous devriez voir l\'embed "Vision Divine Activée!"');
      console.log('   3. Cliquez sur "Voir le contenu" pour révéler');
      console.log('   4. Les charges devraient diminuer de 1\n');
    }

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

verifyVisionDivineFixes();
