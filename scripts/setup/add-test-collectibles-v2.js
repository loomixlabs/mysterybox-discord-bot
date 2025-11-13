const Database = require('better-sqlite3');
const path = require('path');

// Ouvrir la base de données
const db = new Database(path.join(__dirname, 'bot.db'));

console.log('📦 Ajout de collectibles de test (V2)...\n');

try {
  // Récupérer le thème Blanche-Neige
  const theme = db.prepare('SELECT * FROM themes WHERE theme_id = ?').get('blanche-neige');

  if (!theme) {
    console.error('❌ Thème "blanche-neige" introuvable !');
    process.exit(1);
  }

  console.log(`✅ Thème trouvé: ${theme.name} (ID: ${theme.id})\n`);

  // Collectibles V2 (sans rôles individuels)
  const collectibles = [
    {
      collectible_id: 'simplet',
      name: 'Simplet',
      image_url: 'https://i.imgur.com/simplet.png',
      rarity: 'common',
      reveal_message: '🤪 Tu as trouvé SIMPLET, le nain le plus rigolo !'
    },
    {
      collectible_id: 'atchoum',
      name: 'Atchoum',
      image_url: 'https://i.imgur.com/atchoum.png',
      rarity: 'common',
      reveal_message: '🤧 ATCHOUM ! Tu as attrapé... Atchoum !'
    },
    {
      collectible_id: 'dormeur',
      name: 'Dormeur',
      image_url: 'https://i.imgur.com/dormeur.png',
      rarity: 'common',
      reveal_message: '😴 Zzz... Tu as réveillé Dormeur !'
    },
    {
      collectible_id: 'joyeux',
      name: 'Joyeux',
      image_url: 'https://i.imgur.com/joyeux.png',
      rarity: 'rare',
      reveal_message: '😄 YOUPIII ! Tu as trouvé Joyeux !'
    },
    {
      collectible_id: 'grincheux',
      name: 'Grincheux',
      image_url: 'https://i.imgur.com/grincheux.png',
      rarity: 'epic',
      reveal_message: '😠 Grr... Tu as capturé Grincheux (mais il n\'est pas content) !'
    },
    {
      collectible_id: 'timide',
      name: 'Timide',
      image_url: 'https://i.imgur.com/timide.png',
      rarity: 'common',
      reveal_message: '😳 Euh... bonjour... Tu as trouvé Timide !'
    },
    {
      collectible_id: 'prof',
      name: 'Prof',
      image_url: 'https://i.imgur.com/prof.png',
      rarity: 'legendary',
      reveal_message: '🤓 Bravo ! Tu as trouvé Prof, le plus sage des nains !'
    }
  ];

  // Insérer les collectibles
  const insertStmt = db.prepare(`
    INSERT INTO collectibles (
      theme_id, collectible_id, name, image_url, rarity, reveal_message
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const col of collectibles) {
    try {
      insertStmt.run(
        theme.id,
        col.collectible_id,
        col.name,
        col.image_url,
        col.rarity,
        col.reveal_message
      );
      count++;
      console.log(`✅ Ajouté: ${col.name} (${col.rarity})`);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log(`⚠️  Déjà présent: ${col.name}`);
      } else {
        throw err;
      }
    }
  }

  console.log(`\n🎉 ${count} collectibles ajoutés avec succès !`);

  // Vérifier le total
  const total = db.prepare('SELECT COUNT(*) as count FROM collectibles WHERE theme_id = ?').get(theme.id);
  console.log(`📊 Total de collectibles pour "${theme.name}": ${total.count}/7\n`);

  db.close();

} catch (error) {
  console.error('🔴 Erreur:', error);
  process.exit(1);
}
