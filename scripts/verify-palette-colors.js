const db = require('../utils/database-pg');

/**
 * Palettes de couleurs définies dans serverConfigHandler.js
 */
const COLOR_PALETTES = {
  basiques: [
    { name: '🔴 Rouge Classique', value: '#FF0000', emoji: '🔴' },
    { name: '🟠 Orange Vibrant', value: '#FFA500', emoji: '🟠' },
    { name: '🟡 Jaune Soleil', value: '#FFD700', emoji: '🟡' },
    { name: '🟢 Vert Émeraude', value: '#00FF00', emoji: '🟢' },
    { name: '🔵 Bleu Ciel', value: '#0099FF', emoji: '🔵' },
    { name: '🟣 Violet Améthyste', value: '#9B59B6', emoji: '🟣' },
    { name: '⚫ Noir Charbon', value: '#2C3E50', emoji: '⚫' },
    { name: '⚪ Blanc Pur', value: '#FFFFFF', emoji: '⚪' }
  ],
  tendances2025: [
    { name: '💎 Bleu Saphir', value: '#3498DB', emoji: '💎' },
    { name: '🌿 Vert Jade', value: '#2ECC71', emoji: '🌿' },
    { name: '🔥 Rouge Cardinal', value: '#E74C3C', emoji: '🔥' },
    { name: '🌸 Rose Sakura', value: '#FF69B4', emoji: '🌸' },
    { name: '🌊 Bleu Océan', value: '#1ABC9C', emoji: '🌊' },
    { name: '🍊 Orange Mandarine', value: '#F39C12', emoji: '🍊' },
    { name: '🌙 Bleu Nuit', value: '#34495E', emoji: '🌙' },
    { name: '☀️ Jaune Doré', value: '#F1C40F', emoji: '☀️' }
  ],
  pastel: [
    { name: '🧁 Rose Pastel', value: '#FFB3D9', emoji: '🧁' },
    { name: '🍰 Bleu Pastel', value: '#AED6F1', emoji: '🍰' },
    { name: '🍡 Violet Pastel', value: '#D7BDE2', emoji: '🍡' },
    { name: '🍃 Vert Pastel', value: '#ABEBC6', emoji: '🍃' },
    { name: '🍑 Pêche Pastel', value: '#FADBD8', emoji: '🍑' },
    { name: '🌈 Lavande Pastel', value: '#E8DAEF', emoji: '🌈' }
  ],
  vives: [
    { name: '⚡ Jaune Électrique', value: '#FFFF00', emoji: '⚡' },
    { name: '💚 Vert Néon', value: '#39FF14', emoji: '💚' },
    { name: '💙 Cyan Néon', value: '#00FFFF', emoji: '💙' },
    { name: '💜 Magenta Vif', value: '#FF00FF', emoji: '💜' },
    { name: '🧡 Orange Fluo', value: '#FF6600', emoji: '🧡' }
  ],
  professionnelles: [
    { name: '💼 Bleu Corporate', value: '#2C3E50', emoji: '💼' },
    { name: '📊 Gris Ardoise', value: '#95A5A6', emoji: '📊' },
    { name: '🎯 Rouge Entreprise', value: '#C0392B', emoji: '🎯' },
    { name: '📈 Vert Business', value: '#27AE60', emoji: '📈' },
    { name: '⭐ Or Premium', value: '#D4AF37', emoji: '⭐' }
  ]
};

/**
 * Catégoriser les couleurs par type
 */
const CATEGORY_MAP = {
  'red': ['#FF0000', '#E74C3C', '#C0392B'],
  'orange': ['#FFA500', '#FF6600', '#F39C12'],
  'yellow': ['#FFD700', '#FFFF00', '#F1C40F'],
  'green': ['#00FF00', '#2ECC71', '#39FF14', '#27AE60', '#ABEBC6'],
  'blue': ['#0099FF', '#3498DB', '#1ABC9C', '#34495E', '#AED6F1', '#00FFFF', '#2C3E50'],
  'purple': ['#9B59B6', '#D7BDE2', '#FF00FF'],
  'pink': ['#FF69B4', '#FFB3D9', '#FADBD8', '#E8DAEF'],
  'neutral': ['#2C3E50', '#FFFFFF', '#95A5A6'],
  'gold': ['#D4AF37']
};

function getCategoryForColor(hexCode) {
  for (const [category, colors] of Object.entries(CATEGORY_MAP)) {
    if (colors.includes(hexCode.toUpperCase())) {
      return category;
    }
  }
  return 'neutral';
}

async function verifyPaletteColors() {
  console.log('🎨 Vérification des couleurs des palettes du sélecteur\n');
  console.log('=' .repeat(80));

  try {
    const report = {
      total: 0,
      existing: 0,
      added: 0,
      byPalette: {}
    };

    for (const [paletteName, colors] of Object.entries(COLOR_PALETTES)) {
      console.log(`\n📋 Palette: ${paletteName.toUpperCase()}`);
      console.log('-'.repeat(80));

      report.byPalette[paletteName] = {
        total: colors.length,
        existing: 0,
        added: 0
      };

      for (const color of colors) {
        report.total++;

        // Enlever l'emoji du nom pour la base de données
        const cleanName = color.name.replace(/^[\u{1F000}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '');

        // Vérifier si la couleur existe déjà
        const existing = await db.getColorByHex(color.value);

        if (existing) {
          console.log(`  ✅ ${color.value.padEnd(8)} ${color.emoji} ${cleanName} - Déjà dans la BD`);
          report.existing++;
          report.byPalette[paletteName].existing++;
        } else {
          // Ajouter la couleur
          const category = getCategoryForColor(color.value);

          await db.query(
            `INSERT INTO colors (name, hex_code, emoji, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (hex_code) DO NOTHING`,
            [cleanName, color.value.toUpperCase(), color.emoji, category]
          );

          console.log(`  ➕ ${color.value.padEnd(8)} ${color.emoji} ${cleanName} - Ajoutée [${category}]`);
          report.added++;
          report.byPalette[paletteName].added++;
        }
      }
    }

    // Rapport final
    console.log('\n');
    console.log('=' .repeat(80));
    console.log('📊 RAPPORT FINAL');
    console.log('=' .repeat(80));
    console.log(`\n🎨 Total de couleurs analysées: ${report.total}`);
    console.log(`   ✅ Déjà existantes: ${report.existing}`);
    console.log(`   ➕ Nouvellement ajoutées: ${report.added}`);

    console.log('\n📋 Détails par palette:');
    for (const [paletteName, stats] of Object.entries(report.byPalette)) {
      console.log(`   ${paletteName.padEnd(20)} | Total: ${stats.total} | Existantes: ${stats.existing} | Ajoutées: ${stats.added}`);
    }

    // Vérifier les 4 sélecteurs
    console.log('\n🔍 SÉLECTEURS DISCORD (4):');
    console.log('-'.repeat(80));
    console.log(`   1️⃣  Couleurs basiques: ${COLOR_PALETTES.basiques.length} couleurs`);
    console.log(`   2️⃣  Tendances 2025: ${COLOR_PALETTES.tendances2025.length} couleurs`);
    console.log(`   3️⃣  Couleurs pastel: ${COLOR_PALETTES.pastel.length} couleurs`);
    console.log(`   4️⃣  Couleurs vives + Professionnelles: ${COLOR_PALETTES.vives.length + COLOR_PALETTES.professionnelles.length} couleurs`);
    console.log(`   📦 Total: ${COLOR_PALETTES.basiques.length + COLOR_PALETTES.tendances2025.length + COLOR_PALETTES.pastel.length + COLOR_PALETTES.vives.length + COLOR_PALETTES.professionnelles.length} couleurs dans les sélecteurs`);

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await db.close();
    console.log('\n✅ Vérification terminée\n');
    process.exit(0);
  }
}

// Exécuter le script
verifyPaletteColors();
