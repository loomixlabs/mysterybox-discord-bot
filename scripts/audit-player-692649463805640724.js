const db = require('../utils/database-pg');

const PLAYER_DISCORD_ID = '692649463805640724';
const GUILD_ID = '1182395170273099806';

async function auditPlayer() {
  try {
    console.log('='.repeat(80));
    console.log('🔍 AUDIT COMPLET DU JOUEUR');
    console.log('='.repeat(80));
    console.log(`Discord ID: ${PLAYER_DISCORD_ID}`);
    console.log(`Guild ID: ${GUILD_ID}`);
    console.log('');

    // 1. Récupérer le joueur
    const player = await db.queryOne(`
      SELECT * FROM players
      WHERE discord_id = $1 AND guild_id = $2
    `, [PLAYER_DISCORD_ID, GUILD_ID]);

    if (!player) {
      console.log('❌ Joueur non trouvé!');
      process.exit(1);
    }

    console.log('📊 INFORMATIONS JOUEUR');
    console.log('-'.repeat(40));
    console.log(`ID DB: ${player.id}`);
    console.log(`Username: ${player.username}`);
    console.log(`Points: ${player.points}`);
    console.log(`Créé le: ${player.created_at}`);
    console.log('');

    // 2. Thème actif
    const activeTheme = await db.queryOne(`
      SELECT * FROM themes
      WHERE guild_id = $1 AND is_active = true
    `, [GUILD_ID]);

    console.log('🎨 THÈME ACTIF');
    console.log('-'.repeat(40));
    if (activeTheme) {
      console.log(`ID: ${activeTheme.id}`);
      console.log(`Nom: ${activeTheme.name}`);
      console.log(`Required items: ${activeTheme.required_items}`);
    } else {
      console.log('❌ Aucun thème actif!');
    }
    console.log('');

    // 3. Progression du joueur
    const progress = activeTheme ? await db.queryOne(`
      SELECT * FROM player_progress
      WHERE player_id = $1 AND guild_id = $2 AND theme_id = $3
    `, [player.id, GUILD_ID, activeTheme.id]) : null;

    console.log('📈 PROGRESSION (player_progress)');
    console.log('-'.repeat(40));
    if (progress) {
      console.log(`Theme ID: ${progress.theme_id}`);
      console.log(`Current items (dans player_progress): ${progress.current_items}`);
      console.log(`Has completed: ${progress.has_completed}`);
    } else {
      console.log('❌ Aucune progression trouvée pour ce thème!');
    }
    console.log('');

    // 4. Collections du joueur (TOUTES)
    const allCollections = await db.queryAll(`
      SELECT c.*, col.name, col.rarity, col.theme_id
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1 AND c.guild_id = $2
      ORDER BY col.theme_id, col.rarity DESC, col.name
    `, [player.id, GUILD_ID]);

    console.log('📦 TOUTES LES COLLECTIONS');
    console.log('-'.repeat(40));
    console.log(`Total entrées dans collections: ${allCollections.length}`);

    // Grouper par thème
    const byTheme = {};
    for (const c of allCollections) {
      if (!byTheme[c.theme_id]) byTheme[c.theme_id] = [];
      byTheme[c.theme_id].push(c);
    }

    for (const [themeId, items] of Object.entries(byTheme)) {
      console.log(`\n  Thème ${themeId}: ${items.length} entrées`);
      for (const item of items) {
        const status = item.lost_at ? '❌ PERDU' : '✅ ACTIF';
        console.log(`    - ${item.name} (${item.rarity}) ${status}`);
        if (item.lost_at) {
          console.log(`      Perdu le: ${item.lost_at}`);
        }
      }
    }
    console.log('');

    // 5. Collections du thème actif UNIQUEMENT
    if (activeTheme) {
      const activeCollections = await db.queryAll(`
        SELECT c.*, col.name, col.rarity
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.player_id = $1
          AND c.guild_id = $2
          AND col.theme_id = $3
          AND c.lost_at IS NULL
        ORDER BY col.rarity DESC, col.name
      `, [player.id, GUILD_ID, activeTheme.id]);

      console.log('🎯 COLLECTIONS THÈME ACTIF (non perdues)');
      console.log('-'.repeat(40));
      console.log(`Nombre de collectibles actifs: ${activeCollections.length}`);

      for (const item of activeCollections) {
        console.log(`  - ${item.name} (${item.rarity})`);
      }
      console.log('');

      // 6. Compter les collectibles uniques du thème
      const uniqueCount = await db.queryOne(`
        SELECT COUNT(DISTINCT c.collectible_id) as count
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.player_id = $1
          AND c.guild_id = $2
          AND col.theme_id = $3
          AND c.lost_at IS NULL
      `, [player.id, GUILD_ID, activeTheme.id]);

      const progressItems = progress ? progress.current_items : 0;

      console.log('📊 RÉSUMÉ INCOHÉRENCES');
      console.log('-'.repeat(40));
      console.log(`player_progress.current_items: ${progressItems}`);
      console.log(`COUNT collections actives: ${activeCollections.length}`);
      console.log(`COUNT DISTINCT collectibles: ${uniqueCount.count}`);

      if (parseInt(progressItems) !== parseInt(uniqueCount.count)) {
        console.log('\n⚠️  INCOHÉRENCE DÉTECTÉE!');
        console.log(`   Le player_progress indique ${progressItems} items`);
        console.log(`   Mais il y a ${uniqueCount.count} collectibles uniques non perdus`);
      } else {
        console.log('\n✅ Pas d\'incohérence entre player_progress et collections');
      }

      // 7. Vérifier les doublons dans collections
      const duplicates = await db.queryAll(`
        SELECT col.name, col.rarity, COUNT(*) as count
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.player_id = $1
          AND c.guild_id = $2
          AND col.theme_id = $3
          AND c.lost_at IS NULL
        GROUP BY c.collectible_id, col.name, col.rarity
        HAVING COUNT(*) > 1
      `, [player.id, GUILD_ID, activeTheme.id]);

      if (duplicates.length > 0) {
        console.log('\n⚠️  DOUBLONS DÉTECTÉS!');
        for (const dup of duplicates) {
          console.log(`   - ${dup.name} (${dup.rarity}): ${dup.count} fois`);
        }
      }

      // 8. Total collectibles disponibles dans le thème
      const totalInTheme = await db.queryOne(`
        SELECT COUNT(*) as count FROM collectibles
        WHERE guild_id = $1 AND theme_id = $2
      `, [GUILD_ID, activeTheme.id]);

      console.log(`\n📦 Total collectibles dans le thème: ${totalInTheme.count}`);
      console.log(`   Required items pour compléter: ${activeTheme.required_items}`);
    }

    // 9. Historique des collectibles perdus
    const lostCollectibles = await db.queryAll(`
      SELECT c.*, col.name, col.rarity, col.theme_id
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND c.lost_at IS NOT NULL
      ORDER BY c.lost_at DESC
      LIMIT 20
    `, [player.id, GUILD_ID]);

    if (lostCollectibles.length > 0) {
      console.log('\n💀 DERNIERS COLLECTIBLES PERDUS');
      console.log('-'.repeat(40));
      for (const item of lostCollectibles) {
        console.log(`  - ${item.name} (${item.rarity}) - Thème ${item.theme_id}`);
        console.log(`    Perdu le: ${item.lost_at}`);
        console.log(`    Source: ${item.source || 'N/A'}`);
      }
    }

    // 10. Vérifier comment le profil calcule les items
    console.log('\n🔍 ANALYSE DU CALCUL PROFIL');
    console.log('-'.repeat(40));

    // Simulation de ce que fait profileQueries
    const profileCount = await db.queryOne(`
      SELECT COUNT(DISTINCT c.collectible_id) as collected
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND col.theme_id = $3
        AND c.lost_at IS NULL
    `, [player.id, GUILD_ID, activeTheme ? activeTheme.id : 0]);

    console.log(`Calcul profil (COUNT DISTINCT, lost_at IS NULL): ${profileCount.collected}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

auditPlayer();
