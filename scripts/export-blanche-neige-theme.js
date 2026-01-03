/**
 * Script d'export du thème Blanche-Neige vers un fichier .theme.json
 * Utilise le ThemeExporter pour créer le preset
 */

const path = require('path');
const ThemeExporter = require('../utils/themeExporter');
const db = require('../utils/database-pg');

// Guild ID du serveur principal
const GUILD_ID = process.env.GUILD_ID || '1248028543389143070';

async function exportBlancheNeigeTheme() {
  console.log('🏔️ Export du thème Blanche-Neige\n');
  console.log('='.repeat(60));

  try {
    // 1. Trouver le thème Blanche-Neige
    console.log('\n📋 Recherche du thème Blanche-Neige...');

    const themes = await db.queryAll(`
      SELECT id, theme_id, name, is_active, required_items, duration_days
      FROM themes
      WHERE guild_id = $1
      ORDER BY is_active DESC, created_at DESC
    `, [GUILD_ID]);

    console.table(themes.map(t => ({
      id: t.id,
      theme_id: t.theme_id,
      name: t.name,
      active: t.is_active ? '✅' : '❌',
      items: t.required_items
    })));

    // Trouver Blanche-Neige (le thème actif ou celui qui contient "neige" ou "blanche")
    let blancheNeigeTheme = themes.find(t =>
      t.name.toLowerCase().includes('blanche') ||
      t.name.toLowerCase().includes('neige') ||
      t.theme_id?.toLowerCase().includes('blanche') ||
      t.theme_id?.toLowerCase().includes('neige')
    );

    // Si non trouvé, prendre le thème actif
    if (!blancheNeigeTheme) {
      blancheNeigeTheme = themes.find(t => t.is_active);
      if (blancheNeigeTheme) {
        console.log(`\n⚠️  Thème "Blanche-Neige" non trouvé explicitement.`);
        console.log(`   Utilisation du thème actif: "${blancheNeigeTheme.name}"`);
      }
    }

    if (!blancheNeigeTheme) {
      console.log('\n❌ Aucun thème Blanche-Neige ou actif trouvé !');
      process.exit(1);
    }

    console.log(`\n✅ Thème trouvé: "${blancheNeigeTheme.name}" (DB ID: ${blancheNeigeTheme.id})`);

    // 2. Compter les éléments
    console.log('\n📊 Analyse du contenu...');

    const [collectibles, traps, missions, quizQuestions] = await Promise.all([
      db.queryAll('SELECT * FROM collectibles WHERE theme_id = $1 AND guild_id = $2', [blancheNeigeTheme.id, GUILD_ID]),
      db.queryAll('SELECT * FROM traps WHERE theme_id = $1 AND guild_id = $2', [blancheNeigeTheme.id, GUILD_ID]),
      db.queryAll('SELECT * FROM missions WHERE theme_id = $1 AND guild_id = $2', [blancheNeigeTheme.id, GUILD_ID]),
      db.queryAll('SELECT * FROM quiz_questions WHERE theme_id = $1 AND guild_id = $2', [blancheNeigeTheme.id, GUILD_ID])
    ]);

    console.log(`   - Collectibles: ${collectibles.length}`);
    console.log(`   - Pièges: ${traps.length}`);
    console.log(`   - Missions: ${missions.length}`);
    console.log(`   - Questions Quiz: ${quizQuestions.length}`);

    // Afficher la répartition par rareté
    const rarityCount = {};
    collectibles.forEach(c => {
      rarityCount[c.rarity] = (rarityCount[c.rarity] || 0) + 1;
    });
    console.log('\n   Répartition des collectibles:');
    Object.entries(rarityCount).sort().forEach(([rarity, count]) => {
      console.log(`   - ${rarity}: ${count}`);
    });

    // 3. Exporter le thème
    console.log('\n📦 Export en cours...');

    const exporter = new ThemeExporter(GUILD_ID);
    const outputPath = path.join(__dirname, '..', 'themes', 'presets', 'blanche-neige.theme.json');

    const result = await exporter.exportToFile(blancheNeigeTheme.id, outputPath, {
      name: 'Blanche-Neige et les 7 Nains',
      description: 'Collectionnez les personnages et objets magiques du conte de Blanche-Neige ! Pomme empoisonnée, miroir magique et les 7 nains vous attendent dans cette aventure féerique.',
      author: 'Bot Discord Themes',
      tags: ['blanche-neige', 'disney', 'conte', 'féerique', 'nains'],
      preview_image: 'https://assets.stickpng.com/images/580b57fcd9996e24bc43c4d3.png'
    });

    if (result.success) {
      console.log(`\n✅ Export réussi !`);
      console.log(`   Fichier: ${result.filePath}`);

      // Afficher un résumé
      console.log('\n📋 Résumé du fichier exporté:');
      console.log(`   - Version: ${result.data.version}`);
      console.log(`   - Thème ID: ${result.data.theme.theme_id}`);
      console.log(`   - Nom: ${result.data.theme.name}`);
      console.log(`   - Durée: ${result.data.theme.duration_days} jours`);
      console.log(`   - Items requis: ${result.data.theme.required_items}`);
      console.log(`   - Collectibles: ${result.data.collectibles.length}`);
      console.log(`   - Pièges: ${result.data.traps.length}`);
      console.log(`   - Missions Quiz: ${result.data.missions.quiz.length}`);
      console.log(`   - Missions Keyword: ${result.data.missions.keyword.length}`);
    } else {
      console.log(`\n❌ Erreur lors de l'export: ${result.error}`);
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

exportBlancheNeigeTheme();
