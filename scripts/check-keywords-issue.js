const db = require('../utils/database-pg');

async function check() {
  console.log('=== Analyse des mots-clés du serveur 1248028543389143070 ===\n');

  const keywords = await db.queryAll(`
    SELECT mk.id, mk.keyword, mk.difficulty, mk.mission_id, m.name as mission_name,
           LENGTH(mk.keyword) as keyword_length
    FROM mission_keywords mk
    JOIN missions m ON mk.mission_id = m.id
    WHERE mk.guild_id = '1248028543389143070'
    ORDER BY LENGTH(mk.keyword) DESC
    LIMIT 30
  `);

  console.log('Mots-clés (triés par longueur):');
  console.table(keywords);

  // Vérifier les labels qui dépassent 100 chars
  console.log('\n=== Vérification des labels ===');
  const difficultyLabels = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' };

  keywords.forEach(kw => {
    const label = `${kw.keyword} (${difficultyLabels[kw.difficulty] || kw.difficulty})`;
    console.log(`ID ${kw.id}: "${label}" - Longueur: ${label.length} chars`);
    if (label.length > 100) {
      console.log('  ⚠️  TROP LONG! Max 100 chars pour Discord.');
    }
  });

  // Vérifier les caractères spéciaux
  console.log('\n=== Mots-clés avec accents ===');
  const accentKeywords = keywords.filter(kw => /[àâäéèêëïîôùûüç]/i.test(kw.keyword));
  accentKeywords.forEach(kw => {
    console.log(`ID ${kw.id}: "${kw.keyword}" (mission ${kw.mission_id})`);
  });

  process.exit(0);
}

check().catch(e => {
  console.error('Erreur:', e);
  process.exit(1);
});
