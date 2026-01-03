const db = require('../utils/database-pg');

async function verifyRoleAttribution() {
  try {
    const GUILD_ID = '297309737135898624'; // Serveur de TEST
    const USER_ID = '297307186307006464'; // xmicordix

    console.log('🎭 VÉRIFICATION - Système d\'attribution automatique des rôles\n');
    console.log('='.repeat(80));

    // 1. Vérifier le thème actif et le rôle configuré
    console.log('\n📋 ÉTAPE 1: Configuration du thème actif\n');

    const theme = await db.query(`
      SELECT t.id, t.name, t.role_id, t.total_collectibles
      FROM themes t
      WHERE t.guild_id = $1
      AND t.is_active = TRUE
      LIMIT 1
    `, [GUILD_ID]);

    if (theme.length === 0) {
      console.log('❌ Aucun thème actif trouvé\n');
      process.exit(1);
    }

    console.log(`✅ Thème actif: ${theme[0].name}`);
    console.log(`   Theme ID: ${theme[0].id}`);
    console.log(`   Role ID configuré: ${theme[0].role_id || 'NON CONFIGURÉ ❌'}`);
    console.log(`   Total collectibles: ${theme[0].total_collectibles}\n`);

    if (!theme[0].role_id) {
      console.log('⚠️  ATTENTION: Aucun rôle n\'est configuré pour ce thème !');
      console.log('   Le bot ne peut pas attribuer de rôle si aucun n\'est défini.\n');
    }

    // 2. Vérifier la progression du joueur
    console.log('='.repeat(80));
    console.log('\n👤 ÉTAPE 2: Progression du joueur\n');

    const player = await db.query(`
      SELECT p.id, p.username, pp.collected_count, pp.has_completed, pp.role_attributed
      FROM players p
      LEFT JOIN player_progress pp ON p.id = pp.player_id
        AND pp.guild_id = p.guild_id
        AND pp.theme_id = $2
      WHERE p.guild_id = $1
      AND p.discord_id = $3
    `, [GUILD_ID, theme[0].id, USER_ID]);

    if (player.length === 0) {
      console.log('❌ Joueur introuvable\n');
      process.exit(1);
    }

    const progress = player[0];
    console.log(`✅ Joueur: ${progress.username}`);
    console.log(`   Collectibles collectés: ${progress.collected_count || 0} / ${theme[0].total_collectibles}`);
    console.log(`   Collection complétée: ${progress.has_completed ? '✅ OUI' : '❌ NON'}`);
    console.log(`   Rôle attribué: ${progress.role_attributed ? '✅ OUI' : '❌ NON'}\n`);

    // 3. Vérifier les collectibles réellement collectés
    console.log('='.repeat(80));
    console.log('\n📦 ÉTAPE 3: Collectibles effectivement collectés\n');

    const collections = await db.query(`
      SELECT col.name, col.rarity, c.collected_at, c.lost_at
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1
      AND c.player_id = $2
      ORDER BY c.collected_at DESC
    `, [GUILD_ID, progress.id]);

    const activeCollections = collections.filter(c => !c.lost_at);
    const lostCollections = collections.filter(c => c.lost_at);

    console.log(`Total collectibles collectés (historique): ${collections.length}`);
    console.log(`   Actuellement possédés: ${activeCollections.length}`);
    console.log(`   Perdus: ${lostCollections.length}\n`);

    if (activeCollections.length > 0) {
      console.log('📋 Collectibles actuellement possédés:\n');
      console.table(activeCollections.map(c => ({
        'Nom': c.name,
        'Rareté': c.rarity,
        'Collecté le': new Date(c.collected_at).toLocaleString('fr-FR')
      })));
    }

    // 4. Vérifier si la collection est complète
    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 ÉTAPE 4: Vérification de la complétion\n');

    const isComplete = activeCollections.length >= theme[0].total_collectibles;
    console.log(`Collection complète: ${isComplete ? '✅ OUI' : '❌ NON'}`);
    console.log(`   (${activeCollections.length} / ${theme[0].total_collectibles} collectibles)\n`);

    if (isComplete && !progress.has_completed) {
      console.log('⚠️  ANOMALIE DÉTECTÉE:');
      console.log('   La collection est complète mais has_completed = FALSE dans player_progress');
      console.log('   Le système n\'a pas détecté la complétion !\n');
    }

    if (isComplete && progress.has_completed && !progress.role_attributed) {
      console.log('⚠️  ANOMALIE DÉTECTÉE:');
      console.log('   La collection est complète et has_completed = TRUE');
      console.log('   MAIS role_attributed = FALSE');
      console.log('   Le rôle n\'a PAS été attribué automatiquement !\n');
    }

    // 5. Rechercher où se fait l'attribution du rôle dans le code
    console.log('='.repeat(80));
    console.log('\n🔍 ÉTAPE 5: Analyse du code d\'attribution\n');

    console.log('Le rôle devrait être attribué automatiquement dans:');
    console.log('   1. handlers/mysteryBoxHandler.js - après collecte d\'un collectible');
    console.log('   2. Vérification: checkCollectionCompletion() ou similaire');
    console.log('   3. Attribution: member.roles.add(roleId)\n');

    // 6. Vérifier les rôles Discord actuels
    console.log('='.repeat(80));
    console.log('\n👑 ÉTAPE 6: Recommandations\n');

    if (!theme[0].role_id) {
      console.log('❌ CRITIQUE: Aucun rôle configuré pour le thème actif');
      console.log('   Action: Utiliser la commande /admin-panel → Configure Theme → Définir un rôle\n');
    } else if (isComplete && !progress.role_attributed) {
      console.log('⚠️  Le rôle devrait être attribué mais ne l\'a pas été.');
      console.log('   Causes possibles:');
      console.log('   1. Le code d\'attribution automatique ne fonctionne pas');
      console.log('   2. Une erreur Discord (permissions, rôle supprimé, etc.)');
      console.log('   3. Le membre a quitté puis rejoint le serveur\n');
      console.log('💡 Solution: Vérifier les logs Discord et le code d\'attribution dans mysteryBoxHandler.js\n');
    } else if (isComplete && progress.role_attributed) {
      console.log('✅ Tout semble correct: Collection complète et rôle attribué\n');
    } else {
      console.log('ℹ️  Collection non complète - Le rôle sera attribué automatiquement à la complétion\n');
    }

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyRoleAttribution();
