const db = require('./utils/database-pg');

async function verifyCollectibles() {
  try {
    console.log('🔍 VÉRIFICATION COLLECTIBLES POUR THÈME ACTIF\n');
    console.log('='.repeat(80));

    const guildId = process.env.GUILD_ID;

    // Récupérer le thème actif
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
      console.log('❌ Aucun thème actif trouvé');
      process.exit(1);
    }

    console.log(`\n📌 Thème actif: ${theme.name} (ID: ${theme.id})`);
    console.log('='.repeat(80));

    // Récupérer TOUS les collectibles du thème
    const allCollectibles = await db.queryAll(
      `SELECT * FROM collectibles
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY rarity, name`,
      [guildId, theme.id]
    );

    console.log(`\n📦 Total collectibles: ${allCollectibles.length}\n`);

    if (allCollectibles.length === 0) {
      console.log('⚠️  AUCUN COLLECTIBLE TROUVÉ POUR CE THÈME !');
      console.log('❌ C\'est pourquoi le message "⚠️ Malheureusement, aucun collectible n\'est disponible" s\'affiche');
      console.log('\n💡 Solution: Ajouter des collectibles via le panneau admin (/admin-panel)');
    } else {
      console.table(allCollectibles.map(c => ({
        ID: c.id,
        Nom: c.name,
        Rareté: c.rarity,
        'Image URL': c.image_url ? 'Oui' : 'Non'
      })));

      console.log('\n✅ Des collectibles existent pour ce thème');
      console.log('💡 Si le message "no collectible" s\'affiche, c\'est un bug dans getRandomCollectible()');
    }

    // Tester getRandomCollectible
    console.log('\n🎲 Test getRandomCollectible()...\n');
    const randomCollectible = await db.getRandomCollectible(guildId, theme.id);

    if (randomCollectible) {
      console.log('✅ getRandomCollectible() fonctionne:');
      console.table({
        ID: randomCollectible.id,
        Nom: randomCollectible.name,
        Rareté: randomCollectible.rarity
      });
    } else {
      console.log('❌ getRandomCollectible() retourne NULL alors que des collectibles existent !');
      console.log('🔍 Bug dans utils/database-pg.js ligne getRandomCollectible()');
    }

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

verifyCollectibles();
