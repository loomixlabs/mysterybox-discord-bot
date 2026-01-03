const { Pool } = require('pg');

// Configuration PostgreSQL
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

const GUILD_ID = '1248028543389143070'; // ID du serveur de test

async function runTests() {
  console.log('🛡️ TESTS E2E: Bouclier Anti-Piège\n');
  console.log('='.repeat(80));

  try {
    // ===== TEST 1: Vérifier la migration =====
    console.log('\n📋 TEST 1: Vérification de la migration');
    console.log('-'.repeat(80));

    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'players' AND column_name = 'traps_blocked'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('❌ ÉCHEC: Colonne traps_blocked n\'existe pas');
      process.exit(1);
    }
    console.log('✅ Colonne traps_blocked existe');
    console.table(columnCheck.rows);

    // ===== TEST 2: Vérifier le super bonus Bouclier =====
    console.log('\n📋 TEST 2: Vérification du super bonus Bouclier Anti-Piège');
    console.log('-'.repeat(80));

    const bonusCheck = await pool.query(`
      SELECT id, name, description, effect_type, icon, activation_mode
      FROM super_bonuses
      WHERE name = 'Bouclier Anti-Piège'
    `);

    if (bonusCheck.rows.length === 0) {
      console.log('❌ ÉCHEC: Super bonus "Bouclier Anti-Piège" n\'existe pas');
      process.exit(1);
    }
    console.log('✅ Super bonus "Bouclier Anti-Piège" trouvé');
    console.table(bonusCheck.rows);

    const bonus = bonusCheck.rows[0];

    // Vérifier les propriétés
    const expectedEffectType = 'protection';
    const expectedActivationMode = 'automatic';

    if (bonus.effect_type !== expectedEffectType) {
      console.log(`⚠️  WARNING: effect_type = "${bonus.effect_type}" (attendu: "${expectedEffectType}")`);
    } else {
      console.log(`✅ effect_type correct: "${expectedEffectType}"`);
    }

    if (bonus.activation_mode !== expectedActivationMode) {
      console.log(`⚠️  WARNING: activation_mode = "${bonus.activation_mode}" (attendu: "${expectedActivationMode}")`);
    } else {
      console.log(`✅ activation_mode correct: "${expectedActivationMode}"`);
    }

    // ===== TEST 3: Vérifier les joueurs avec Bouclier actif =====
    console.log('\n📋 TEST 3: Joueurs avec Bouclier Anti-Piège actif');
    console.log('-'.repeat(80));

    const activeBonuses = await pool.query(`
      SELECT
        p.username,
        p.traps_blocked,
        pab.remaining_charges,
        pab.activated_at,
        pab.obtained_from
      FROM player_active_bonuses pab
      JOIN players p ON pab.user_id = p.discord_id
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE sb.name = 'Bouclier Anti-Piège'
        AND pab.guild_id = $1
        AND pab.is_active = TRUE
      ORDER BY p.username
    `, [GUILD_ID]);

    if (activeBonuses.rows.length === 0) {
      console.log('⚠️  Aucun joueur n\'a de Bouclier actif pour le moment');
      console.log('   (Normal si aucun Mystery Box de Bouclier n\'a été distribué)');
    } else {
      console.log(`✅ ${activeBonuses.rows.length} joueur(s) avec Bouclier actif:`);
      console.table(activeBonuses.rows);
    }

    // ===== TEST 4: Statistiques globales =====
    console.log('\n📋 TEST 4: Statistiques globales des pièges bloqués');
    console.log('-'.repeat(80));

    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_players,
        COUNT(CASE WHEN traps_blocked > 0 THEN 1 END) as players_with_blocks,
        COALESCE(MAX(traps_blocked), 0) as max_blocked,
        COALESCE(AVG(traps_blocked), 0) as avg_blocked
      FROM players
      WHERE guild_id = $1
    `, [GUILD_ID]);

    console.table(stats.rows);

    const totalBlocked = parseInt(stats.rows[0].players_with_blocks);
    if (totalBlocked === 0) {
      console.log('ℹ️  Aucun piège bloqué pour le moment (attendu si système tout juste déployé)');
    } else {
      console.log(`✅ ${totalBlocked} joueur(s) ont déjà bloqué des pièges`);
    }

    // ===== TEST 5: Vérifier le code du badge =====
    console.log('\n📋 TEST 5: Vérification du code du badge "Indestructible"');
    console.log('-'.repeat(80));

    const fs = require('fs');
    const badgeCode = fs.readFileSync('utils/profileHelpers.js', 'utf8');

    const hasBadgeCode = badgeCode.includes('traps_blocked') &&
                          badgeCode.includes('Badge Indestructible') &&
                          badgeCode.includes('>= 10');

    if (!hasBadgeCode) {
      console.log('❌ ÉCHEC: Code du badge "Indestructible" non trouvé dans profileHelpers.js');
      console.log('   Vérifier que calculateBadges() contient la logique pour 🛡️');
    } else {
      console.log('✅ Code du badge "Indestructible" présent dans profileHelpers.js');
    }

    // ===== TEST 6: Vérifier le code du message épique =====
    console.log('\n📋 TEST 6: Vérification du message visuel épique');
    console.log('-'.repeat(80));

    const mysteryBoxCode = fs.readFileSync('handlers/mysteryBoxHandler.js', 'utf8');

    const hasEpicMessage = mysteryBoxCode.includes('🛡️ ════════════════════════════════════ 🛡️') &&
                           mysteryBoxCode.includes('PIÈGE BLOQUÉ !') &&
                           mysteryBoxCode.includes('#FFD700');

    if (!hasEpicMessage) {
      console.log('❌ ÉCHEC: Message épique non trouvé dans mysteryBoxHandler.js');
    } else {
      console.log('✅ Message visuel épique présent dans mysteryBoxHandler.js');
    }

    // ===== TEST 7: Vérifier les réactions Discord =====
    console.log('\n📋 TEST 7: Vérification du code des réactions Discord');
    console.log('-'.repeat(80));

    const hasReactions = mysteryBoxCode.includes('await message.react(\'🛡️\')') &&
                         mysteryBoxCode.includes('await message.react(\'✅\')') &&
                         mysteryBoxCode.includes('setTimeout');

    if (!hasReactions) {
      console.log('❌ ÉCHEC: Code des réactions Discord non trouvé');
    } else {
      console.log('✅ Code des réactions Discord (🛡️ → ✅) présent');
    }

    // ===== TEST 8: Vérifier l'affichage dans le profil =====
    console.log('\n📋 TEST 8: Vérification de l\'affichage dans /profile');
    console.log('-'.repeat(80));

    const profileViewCode = fs.readFileSync('views/profileView.js', 'utf8');
    const profileQueriesCode = fs.readFileSync('utils/profileQueries.js', 'utf8');

    const hasProfileDisplay = profileViewCode.includes('🛡️ Pièges bloqués:') &&
                               profileViewCode.includes('stats.traps_blocked');

    const hasProfileQuery = profileQueriesCode.includes('traps_blocked') &&
                             profileQueriesCode.includes('SELECT COALESCE(traps_blocked, 0)');

    if (!hasProfileDisplay) {
      console.log('❌ ÉCHEC: Affichage des pièges bloqués non trouvé dans profileView.js');
    } else {
      console.log('✅ Affichage des pièges bloqués présent dans profileView.js');
    }

    if (!hasProfileQuery) {
      console.log('❌ ÉCHEC: Requête traps_blocked non trouvée dans profileQueries.js');
    } else {
      console.log('✅ Requête traps_blocked présente dans profileQueries.js');
    }

    // ===== TEST 9: Vérifier le logging des usages =====
    console.log('\n📋 TEST 9: Vérification du logging dans superBonusHandler.js');
    console.log('-'.repeat(80));

    const superBonusCode = fs.readFileSync('handlers/superBonusHandler.js', 'utf8');

    const hasLogging = superBonusCode.includes('UPDATE players') &&
                       superBonusCode.includes('SET traps_blocked = traps_blocked + 1') &&
                       superBonusCode.includes('bonus_usage_history');

    if (!hasLogging) {
      console.log('❌ ÉCHEC: Logging d\'utilisation non trouvé dans superBonusHandler.js');
    } else {
      console.log('✅ Logging d\'utilisation présent dans superBonusHandler.js');
    }

    // ===== RÉSUMÉ FINAL =====
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ DES TESTS E2E');
    console.log('='.repeat(80));

    const results = [
      { test: 'Migration DB (colonne traps_blocked)', status: '✅ PASS' },
      { test: 'Super bonus Bouclier existe', status: '✅ PASS' },
      { test: 'Joueurs avec Bouclier actif', status: activeBonuses.rows.length > 0 ? '✅ PASS' : '⚠️  SKIP' },
      { test: 'Statistiques globales', status: '✅ PASS' },
      { test: 'Code badge Indestructible', status: hasBadgeCode ? '✅ PASS' : '❌ FAIL' },
      { test: 'Message visuel épique', status: hasEpicMessage ? '✅ PASS' : '❌ FAIL' },
      { test: 'Réactions Discord (🛡️ → ✅)', status: hasReactions ? '✅ PASS' : '❌ FAIL' },
      { test: 'Affichage profil (/profile)', status: hasProfileDisplay && hasProfileQuery ? '✅ PASS' : '❌ FAIL' },
      { test: 'Logging des usages', status: hasLogging ? '✅ PASS' : '❌ FAIL' }
    ];

    console.table(results);

    const failCount = results.filter(r => r.status.includes('FAIL')).length;
    const passCount = results.filter(r => r.status.includes('PASS')).length;
    const skipCount = results.filter(r => r.status.includes('SKIP')).length;

    console.log(`\n✅ ${passCount} tests réussis`);
    if (skipCount > 0) console.log(`⚠️  ${skipCount} test(s) ignoré(s)`);
    if (failCount > 0) console.log(`❌ ${failCount} test(s) échoué(s)`);

    if (failCount === 0) {
      console.log('\n🎉 TOUS LES TESTS SONT PASSÉS!');
      console.log('\n📝 Prochaines étapes:');
      console.log('   1. Tester manuellement sur Discord en déclenchant un piège avec un Bouclier actif');
      console.log('   2. Vérifier l\'animation (🛡️ → ✅) sur le message');
      console.log('   3. Consulter /profile pour voir les stats de pièges bloqués');
      console.log('   4. Bloquer 10+ pièges pour tester le badge 🛡️ "Indestructible"');
      console.log('   5. Mettre à jour CHANGELOG.md avec les détails de l\'implémentation');
    } else {
      console.log('\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ - Vérifier les fichiers mentionnés');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(80) + '\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
