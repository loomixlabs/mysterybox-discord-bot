require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';
const PLAYER_DISCORD_ID = '1196568636681363507';
const ROLE_ID = '1437539197987852388';

async function quickDiagnostic() {
  try {
    console.log('🔍 DIAGNOSTIC RAPIDE ATTRIBUTION RÔLE\n');
    console.log('='.repeat(80));

    // 1. Récupérer le joueur
    const player = await db.queryOne(
      'SELECT * FROM players WHERE guild_id = $1 AND discord_id = $2',
      [GUILD_ID, PLAYER_DISCORD_ID]
    );

    if (!player) {
      console.log('❌ Joueur introuvable');
      process.exit(1);
    }

    console.log(`✅ Joueur: ${player.username} (ID: ${player.id})`);

    // 2. Récupérer le thème actif
    const theme = await db.queryOne(
      'SELECT * FROM themes WHERE guild_id = $1 AND is_active = TRUE',
      [GUILD_ID]
    );

    console.log(`✅ Thème actif: ${theme.name}`);
    console.log(`   Role ID: ${theme.final_role_discord_id}`);
    console.log(`   Role Name: ${theme.final_role_name}`);
    console.log(`   Role Color: ${theme.final_role_color}\n`);

    // 3. Vérifier la progression du joueur
    const progress = await db.queryOne(
      `SELECT * FROM player_progress
       WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3`,
      [GUILD_ID, player.id, theme.id]
    );

    if (progress) {
      console.log('📊 PROGRESSION DU JOUEUR:');
      console.log(`   Collected: ${progress.collected_count}`);
      console.log(`   Is completed: ${progress.is_completed}`);
      console.log(`   Completed at: ${progress.completed_at || 'N/A'}\n`);
    } else {
      console.log('⚠️  Aucune progression trouvée pour ce joueur\n');
    }

    // 4. Compter les collectibles du thème
    const totalCollectibles = await db.queryOne(
      `SELECT COUNT(*) as count FROM collectibles
       WHERE guild_id = $1 AND theme_id = $2`,
      [GUILD_ID, theme.id]
    );

    console.log(`📦 Total collectibles du thème: ${totalCollectibles.count}`);

    // 5. Compter les collectibles possédés par le joueur (actifs uniquement)
    const ownedCollectibles = await db.queryOne(
      `SELECT COUNT(*) as count FROM collections c
       JOIN collectibles col ON c.collectible_id = col.id
       WHERE c.guild_id = $1
         AND c.player_id = $2
         AND col.theme_id = $3
         AND c.lost_at IS NULL`,
      [GUILD_ID, player.id, theme.id]
    );

    console.log(`✅ Collectibles possédés (actifs): ${ownedCollectibles.count}\n`);

    // 6. Résumé du diagnostic
    console.log('=' .repeat(80));
    console.log('📊 RÉSUMÉ DU DIAGNOSTIC\n');

    const isCollectionComplete = parseInt(ownedCollectibles.count) === parseInt(totalCollectibles.count);
    const isMarkedCompleted = progress?.is_completed === true;
    const hasRoleConfigured = theme.final_role_discord_id !== null;

    console.table({
      'Collection complète (comptage)': isCollectionComplete ? '✅ OUI' : '❌ NON',
      'is_completed (DB flag)': isMarkedCompleted ? '✅ TRUE' : '❌ FALSE',
      'Role ID configuré': hasRoleConfigured ? '✅ OUI' : '❌ NON',
      'Collectibles': `${ownedCollectibles.count}/${totalCollectibles.count}`,
      'Role ID': theme.final_role_discord_id,
      'Completed at': progress?.completed_at || 'NULL'
    });

    // 7. Diagnostic du problème
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DIAGNOSTIC DU PROBLÈME\n');

    if (!isCollectionComplete) {
      console.log('❌ PROBLÈME: Collection incomplète');
      console.log(`   Il manque ${totalCollectibles.count - ownedCollectibles.count} collectible(s)`);
    } else if (!isMarkedCompleted) {
      console.log('⚠️  PROBLÈME: Collection complète mais is_completed = FALSE');
      console.log('   → Le flag is_completed n\'a pas été mis à jour');
      console.log('   → L\'attribution de rôle dépend probablement de ce flag');
    } else if (!hasRoleConfigured) {
      console.log('⚠️  PROBLÈME: Aucun role_id configuré sur le thème');
    } else {
      console.log('⚠️  PROBLÈME: Collection complète + is_completed = TRUE + Role configuré');
      console.log('   → Mais le rôle n\'a PAS été attribué sur Discord');
      console.log('   → Le code d\'attribution de rôle n\'a pas été exécuté');
      console.log('   → OU une erreur s\'est produite lors de l\'attribution\n');

      console.log('📄 Fichiers à vérifier pour trouver le code d\'attribution:');
      console.log('   - utils/database-pg.js (méthode updatePlayerProgress ou similaire)');
      console.log('   - handlers/mysteryBoxHandler.js (après addCollectible)');
      console.log('   - events/messageCreate.js (après validation mission)');
      console.log('   - utils/announcements.js (announceCollectionCompleted)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

quickDiagnostic();
