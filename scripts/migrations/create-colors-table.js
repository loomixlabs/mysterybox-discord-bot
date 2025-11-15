require('dotenv').config();
const db = require('../../utils/database-pg');

async function createColorsTable() {
  console.log('🎨 Création de la table colors pour gérer les couleurs\n');
  console.log('━'.repeat(100));

  try {
    console.log('\n📊 ÉTAPE 1: Création de la table colors\n');

    await db.query(`
      CREATE TABLE IF NOT EXISTS colors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        hex_code TEXT NOT NULL UNIQUE,
        emoji TEXT,
        category TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('   ✅ Table colors créée\n');

    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 2: Insertion des couleurs par défaut\n');

    // Couleurs de la palette Bleu
    const blueColors = [
      { name: 'Bleu ciel', hex: '#87CEEB', emoji: '🌤️', category: 'blue' },
      { name: 'Bleu royal', hex: '#4169E1', emoji: '👑', category: 'blue' },
      { name: 'Bleu acier', hex: '#4682B4', emoji: '🔩', category: 'blue' },
      { name: 'Bleu marine', hex: '#000080', emoji: '⚓', category: 'blue' },
      { name: 'Turquoise', hex: '#40E0D0', emoji: '💎', category: 'blue' }
    ];

    // Couleurs de la palette Rouge
    const redColors = [
      { name: 'Rouge vif', hex: '#FF0000', emoji: '🔴', category: 'red' },
      { name: 'Cramoisi', hex: '#DC143C', emoji: '🌹', category: 'red' },
      { name: 'Rouge tomate', hex: '#FF6347', emoji: '🍅', category: 'red' },
      { name: 'Rouge brique', hex: '#B22222', emoji: '🧱', category: 'red' },
      { name: 'Bordeaux', hex: '#800020', emoji: '🍷', category: 'red' }
    ];

    // Couleurs de la palette Vert
    const greenColors = [
      { name: 'Vert lime', hex: '#00FF00', emoji: '🍏', category: 'green' },
      { name: 'Vert forêt', hex: '#228B22', emoji: '🌲', category: 'green' },
      { name: 'Vert émeraude', hex: '#50C878', emoji: '💚', category: 'green' },
      { name: 'Vert olive', hex: '#808000', emoji: '🫒', category: 'green' },
      { name: 'Vert menthe', hex: '#98FF98', emoji: '🌿', category: 'green' }
    ];

    // Couleurs de la palette Violet
    const purpleColors = [
      { name: 'Violet', hex: '#8B00FF', emoji: '💜', category: 'purple' },
      { name: 'Lavande', hex: '#E6E6FA', emoji: '🪻', category: 'purple' },
      { name: 'Orchidée', hex: '#DA70D6', emoji: '🌸', category: 'purple' },
      { name: 'Prune', hex: '#8E4585', emoji: '🍇', category: 'purple' },
      { name: 'Indigo', hex: '#4B0082', emoji: '🔮', category: 'purple' }
    ];

    // Couleurs de la palette Orange
    const orangeColors = [
      { name: 'Orange vif', hex: '#FFA500', emoji: '🍊', category: 'orange' },
      { name: 'Corail', hex: '#FF7F50', emoji: '🪸', category: 'orange' },
      { name: 'Pêche', hex: '#FFE5B4', emoji: '🍑', category: 'orange' },
      { name: 'Abricot', hex: '#FBCEB1', emoji: '🧡', category: 'orange' },
      { name: 'Orange brûlé', hex: '#CC5500', emoji: '🔥', category: 'orange' }
    ];

    // Couleurs de la palette Rose
    const pinkColors = [
      { name: 'Rose bonbon', hex: '#FF69B4', emoji: '🍬', category: 'pink' },
      { name: 'Rose pâle', hex: '#FFB6C1', emoji: '🌸', category: 'pink' },
      { name: 'Rose fuchsia', hex: '#FF00FF', emoji: '💗', category: 'pink' },
      { name: 'Rose saumon', hex: '#FF91A4', emoji: '🐟', category: 'pink' },
      { name: 'Rose vif', hex: '#FF1493', emoji: '🌺', category: 'pink' }
    ];

    // Couleurs de la palette Jaune
    const yellowColors = [
      { name: 'Jaune vif', hex: '#FFFF00', emoji: '💛', category: 'yellow' },
      { name: 'Or', hex: '#FFD700', emoji: '🏆', category: 'yellow' },
      { name: 'Citron', hex: '#FFF44F', emoji: '🍋', category: 'yellow' },
      { name: 'Moutarde', hex: '#FFDB58', emoji: '🌻', category: 'yellow' },
      { name: 'Jaune pâle', hex: '#FFFFE0', emoji: '☀️', category: 'yellow' }
    ];

    // Couleurs neutres
    const neutralColors = [
      { name: 'Blanc', hex: '#FFFFFF', emoji: '⚪', category: 'neutral' },
      { name: 'Noir', hex: '#000000', emoji: '⚫', category: 'neutral' },
      { name: 'Gris', hex: '#808080', emoji: '🩶', category: 'neutral' },
      { name: 'Gris clair', hex: '#D3D3D3', emoji: '🤍', category: 'neutral' },
      { name: 'Gris foncé', hex: '#404040', emoji: '🖤', category: 'neutral' }
    ];

    // Combiner toutes les couleurs
    const allColors = [
      ...blueColors,
      ...redColors,
      ...greenColors,
      ...purpleColors,
      ...orangeColors,
      ...pinkColors,
      ...yellowColors,
      ...neutralColors
    ];

    // Insérer toutes les couleurs
    for (const color of allColors) {
      await db.query(`
        INSERT INTO colors (name, hex_code, emoji, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (hex_code) DO NOTHING
      `, [color.name, color.hex, color.emoji, color.category]);

      console.log(`   ✅ ${color.emoji} ${color.name} (${color.hex})`);
    }

    console.log(`\n   ✅ ${allColors.length} couleurs insérées\n`);

    // Vérification
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 3: Vérification\n');

    const result = await db.query('SELECT COUNT(*) as count FROM colors');
    console.log(`   ✅ ${result[0].count} couleurs en base de données\n`);

    console.log('━'.repeat(100));
    console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    throw error;
  } finally {
    await db.close();
  }
}

createColorsTable();
