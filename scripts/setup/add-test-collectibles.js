const Database = require('better-sqlite3');
const path = require('path');

// Ouvrir la base de données
const db = new Database(path.join(__dirname, 'bot.db'));

console.log('📦 Ajout de collectibles de test...\n');

try {
  // Récupérer le thème Blanche-Neige
  const theme = db.prepare('SELECT * FROM themes WHERE theme_id = ?').get('blanche-neige');

  if (!theme) {
    console.error('❌ Thème "blanche-neige" introuvable !');
    process.exit(1);
  }

  console.log(`✅ Thème trouvé: ${theme.name} (ID: ${theme.id})\n`);

  // Collectibles de test (les 7 nains)
  const collectibles = [
    {
      collectible_id: 'simplet',
      name: 'Simplet',
      role_name: '🤪 Simplet',
      role_color: '#FF6B6B',
      image_url: 'https://i.imgur.com/placeholder1.png',
      has_mission: 0
    },
    {
      collectible_id: 'atchoum',
      name: 'Atchoum',
      role_name: '🤧 Atchoum',
      role_color: '#4ECDC4',
      image_url: 'https://i.imgur.com/placeholder2.png',
      has_mission: 1,
      mission_type: 'message',
      mission_desc: 'Poste un message dans #général avec le mot "éternuer"',
      mission_timeout: 30
    },
    {
      collectible_id: 'dormeur',
      name: 'Dormeur',
      role_name: '😴 Dormeur',
      role_color: '#95E1D3',
      image_url: 'https://i.imgur.com/placeholder3.png',
      has_mission: 0
    },
    {
      collectible_id: 'joyeux',
      name: 'Joyeux',
      role_name: '😄 Joyeux',
      role_color: '#F38181',
      image_url: 'https://i.imgur.com/placeholder4.png',
      has_mission: 0
    },
    {
      collectible_id: 'grincheux',
      name: 'Grincheux',
      role_name: '😠 Grincheux',
      role_color: '#AA96DA',
      image_url: 'https://i.imgur.com/placeholder5.png',
      has_mission: 1,
      mission_type: 'manual',
      mission_desc: 'Écris une phrase grincheuse et fais-la valider par un admin',
      mission_timeout: 60
    },
    {
      collectible_id: 'timide',
      name: 'Timide',
      role_name: '😳 Timide',
      role_color: '#FCBAD3',
      image_url: 'https://i.imgur.com/placeholder6.png',
      has_mission: 0
    },
    {
      collectible_id: 'prof',
      name: 'Prof',
      role_name: '🤓 Prof',
      role_color: '#FFFFD2',
      image_url: 'https://i.imgur.com/placeholder7.png',
      has_mission: 0
    }
  ];

  // Insérer les collectibles
  const insertStmt = db.prepare(`
    INSERT INTO collectibles (
      theme_id, collectible_id, name, role_name, role_color,
      image_url, has_mission, mission_type, mission_desc, mission_timeout
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const col of collectibles) {
    try {
      insertStmt.run(
        theme.id,
        col.collectible_id,
        col.name,
        col.role_name,
        col.role_color,
        col.image_url,
        col.has_mission,
        col.mission_type || null,
        col.mission_desc || null,
        col.mission_timeout || null
      );
      count++;
      console.log(`✅ Ajouté: ${col.name} (${col.has_mission ? 'avec mission' : 'sans mission'})`);
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
