const db = require('../utils/database-pg');

/**
 * Liste des couleurs manquantes à ajouter à la base de données
 * Ces couleurs sont utilisées dans le système mais n'étaient pas dans la palette initiale
 */
const MISSING_COLORS = [
  // Rouges
  { name: 'Rouge Alizarine', hex_code: '#E74C3C', emoji: '🔴', category: 'red' },
  { name: 'Rouge Brique', hex_code: '#C0392B', emoji: '🔴', category: 'red' },

  // Oranges
  { name: 'Orange Carotte', hex_code: '#E67E22', emoji: '🟠', category: 'orange' },
  { name: 'Orange Citrouille', hex_code: '#D35400', emoji: '🟠', category: 'orange' },

  // Verts
  { name: 'Vert Émeraude', hex_code: '#2ECC71', emoji: '🟢', category: 'green' },
  { name: 'Vert Néphrite', hex_code: '#27AE60', emoji: '🟢', category: 'green' },

  // Bleus
  { name: 'Bleu Rivière', hex_code: '#3498DB', emoji: '🔵', category: 'blue' },
  { name: 'Bleu Belize', hex_code: '#2980B9', emoji: '🔵', category: 'blue' },

  // Violets/Pourpres
  { name: 'Violet Améthyste', hex_code: '#9B59B6', emoji: '🟣', category: 'purple' },
  { name: 'Pourpre Wisteria', hex_code: '#8E44AD', emoji: '🟣', category: 'purple' },

  // Jaunes
  { name: 'Jaune Tournesol', hex_code: '#F1C40F', emoji: '🟡', category: 'yellow' },
  { name: 'Jaune Safran', hex_code: '#F39C12', emoji: '🟡', category: 'yellow' },

  // Neutres
  { name: 'Gris Nuage', hex_code: '#ECF0F1', emoji: '⚪', category: 'neutral' },
  { name: 'Gris Argent', hex_code: '#BDC3C7', emoji: '⚪', category: 'neutral' },
  { name: 'Gris Béton', hex_code: '#95A5A6', emoji: '⚪', category: 'neutral' },
  { name: 'Gris Asphalte', hex_code: '#7F8C8D', emoji: '⚪', category: 'neutral' },
  { name: 'Noir Minuit', hex_code: '#34495E', emoji: '⚫', category: 'neutral' },
  { name: 'Noir Charbon', hex_code: '#2C3E50', emoji: '⚫', category: 'neutral' }
];

async function addMissingColors() {
  console.log('🎨 Ajout des couleurs manquantes à la base de données...\n');

  try {
    let addedCount = 0;
    let skippedCount = 0;

    for (const color of MISSING_COLORS) {
      // Vérifier si la couleur existe déjà
      const existing = await db.getColorByHex(color.hex_code);

      if (existing) {
        console.log(`⏭️  ${color.hex_code} (${color.name}) - Déjà existante`);
        skippedCount++;
      } else {
        // Ajouter la couleur
        await db.query(
          `INSERT INTO colors (name, hex_code, emoji, category)
           VALUES ($1, $2, $3, $4)`,
          [color.name, color.hex_code, color.emoji, color.category]
        );
        console.log(`✅ ${color.hex_code} - ${color.emoji} ${color.name} ajoutée`);
        addedCount++;
      }
    }

    console.log(`\n📊 Résumé:`);
    console.log(`   ✅ ${addedCount} couleur(s) ajoutée(s)`);
    console.log(`   ⏭️  ${skippedCount} couleur(s) déjà existante(s)`);
    console.log(`   📦 Total: ${MISSING_COLORS.length} couleurs traitées`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des couleurs:', error);
  } finally {
    await db.close();
    console.log('\n✅ Script terminé');
    process.exit(0);
  }
}

// Exécuter le script
addMissingColors();
