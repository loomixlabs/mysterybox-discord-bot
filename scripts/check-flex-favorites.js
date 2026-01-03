require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
  const guildId = '297309737135898624';

  console.log('🔍 Vérification des favoris FLEX\n');
  console.log('='.repeat(60));

  // 1. List all players on this server
  const allPlayers = await db.queryAll('SELECT id, discord_id, username FROM players WHERE guild_id = $1', [guildId]);
  console.log('👥 Joueurs sur le serveur:');
  allPlayers.forEach(p => console.log('   - ID:', p.id, '| Discord:', p.discord_id, '|', p.username));

  // Use xmicordix (ID 1) for testing
  const player = allPlayers.find(p => p.username === 'xmicordix') || allPlayers[0];
  console.log('\n👤 Joueur sélectionné:', player);

  // 2. Get active theme
  const theme = await db.getActiveTheme(guildId);
  console.log('🎨 Thème actif:', theme ? { id: theme.id, name: theme.name } : 'AUCUN');

  if (!player || !theme) {
    console.log('❌ Données manquantes');
    process.exit(1);
  }

  // 3. Get favorites configured
  const favorites = await db.getPlayerFavorites(guildId, player.id);
  console.log('\n⭐ Favoris configurés:', favorites.length);
  favorites.forEach(f => console.log('   Position', f.position, ':', f.name, '-', f.rarity, '- imageUrl:', f.image_url ? f.image_url.substring(0, 50) + '...' : 'NULL'));

  // 4. Get ALL collectibles for this player on this theme
  const collections = await db.queryAll(`
    SELECT c.level, c.mint_number, col.name, col.rarity, col.image_url
    FROM collections c
    JOIN collectibles col ON c.collectible_id = col.id
    WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3 AND c.lost_at IS NULL
    ORDER BY c.level DESC,
      CASE col.rarity
        WHEN 'Légendaire' THEN 1
        WHEN 'Épique' THEN 2
        WHEN 'Rare' THEN 3
        ELSE 4
      END
    LIMIT 5`,
    [guildId, player.id, theme.id]
  );
  console.log('\n📦 Top 5 collectibles du joueur:');
  collections.forEach((c, i) => console.log('  ', i+1, ':', c.name, '-', c.rarity, '- Level', c.level || 1, '- imageUrl:', c.image_url ? c.image_url.substring(0, 50) + '...' : 'NULL'));

  // 5. Total count
  const total = await db.queryOne(`
    SELECT COUNT(*) as count
    FROM collections c
    JOIN collectibles col ON c.collectible_id = col.id
    WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3 AND c.lost_at IS NULL`,
    [guildId, player.id, theme.id]
  );
  console.log('\n📊 Total collectibles possédés:', total.count);

  // 6. Check collectibles available for favorites selection
  const availableForFavorites = await db.getPlayerCollectiblesForFavorites(guildId, player.id, theme.id);
  console.log('\n📋 Collectibles disponibles pour sélection favoris:', availableForFavorites.length);
  availableForFavorites.forEach((c, i) => console.log('  ', i+1, ':', c.name, '-', c.rarity, '- imageUrl:', c.image_url ? 'OUI' : 'NULL'));

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
