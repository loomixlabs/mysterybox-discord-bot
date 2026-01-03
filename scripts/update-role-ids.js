const db = require('../utils/database-pg');

/**
 * Script de mise à jour des IDs de rôles Discord pour les thèmes existants
 *
 * INSTRUCTIONS:
 * 1. Sur Discord, va sur chaque serveur
 * 2. Paramètres du serveur → Rôles
 * 3. Si le rôle n'existe pas, crée-le (couleur #FFD700 recommandée)
 * 4. Clic droit sur le rôle → Copier l'ID
 * 5. Colle l'ID ci-dessous dans roleIds
 * 6. Exécute: node scripts/update-role-ids.js
 */

// ⚠️  ÉDITER ICI: Remplace 'ROLE_ID_ICI' par les vrais IDs Discord
const roleIds = {
  // Serveur TEST (297309737135898624) - Role ID: 1440079992188047592
  1: '1440079992188047592',   // Thème "Blanche-Neige et les 7 Nains" → Rôle "👸 Blanche-Neige"
  17: '1440079992188047592',  // Thème "erzyjuy" → Rôle "zregzer" (même rôle)
  19: '1440079992188047592',  // Thème "giyulg" → Rôle "tukdtu" (même rôle)

  // Serveur PRODUCTION (1248028543389143070) - Role ID: 1437539197987852388
  23: '1437539197987852388'   // Thème "Blanche neige" → Rôle "Blanche neige"
};

async function updateRoleIds() {
  try {
    console.log('🔧 MISE À JOUR - IDs des rôles Discord\n');
    console.log('='.repeat(80));

    // Vérifier que tous les IDs ont été fournis
    const missingIds = Object.entries(roleIds)
      .filter(([_, id]) => id === 'ROLE_ID_ICI')
      .map(([themeId]) => themeId);

    if (missingIds.length > 0) {
      console.log('❌ ERREUR: Certains IDs de rôles manquent\n');
      console.log('Thèmes sans ID configuré:', missingIds.join(', '));
      console.log('\n💡 Ouvre le fichier scripts/update-role-ids.js');
      console.log('   et remplace "ROLE_ID_ICI" par les vrais IDs Discord\n');
      console.log('='.repeat(80));
      process.exit(1);
    }

    console.log('\n📋 ÉTAPE 1: Récupération des thèmes\n');

    const themes = [];
    for (const [themeIdStr, roleId] of Object.entries(roleIds)) {
      const themeId = parseInt(themeIdStr);
      const theme = await db.queryOne(
        'SELECT * FROM themes WHERE id = $1',
        [themeId]
      );

      if (!theme) {
        console.log(`⚠️  Thème ID ${themeId} introuvable - ignoré`);
        continue;
      }

      themes.push({ theme, roleId });
      console.log(`✅ Thème trouvé: ${theme.name} (ID: ${themeId})`);
      console.log(`   Rôle actuel en DB: ${theme.final_role_discord_id || 'NULL'}`);
      console.log(`   Nouveau rôle: ${roleId}\n`);
    }

    if (themes.length === 0) {
      console.log('❌ Aucun thème trouvé à mettre à jour\n');
      console.log('='.repeat(80));
      process.exit(1);
    }

    console.log('='.repeat(80));
    console.log(`\n🔄 ÉTAPE 2: Mise à jour de ${themes.length} thème(s)\n`);

    let updatedCount = 0;
    for (const { theme, roleId } of themes) {
      try {
        await db.query(
          `UPDATE themes
           SET final_role_discord_id = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [roleId, theme.id]
        );

        console.log(`✅ Thème "${theme.name}" (ID: ${theme.id}) mis à jour`);
        console.log(`   Role Discord ID: ${roleId}\n`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Erreur pour le thème ${theme.id}:`, error.message);
      }
    }

    console.log('='.repeat(80));
    console.log(`\n🎯 ÉTAPE 3: Vérification finale\n`);

    for (const { theme } of themes) {
      const updated = await db.queryOne(
        'SELECT final_role_discord_id FROM themes WHERE id = $1',
        [theme.id]
      );

      const status = updated.final_role_discord_id ? '✅' : '❌';
      console.log(`${status} Thème "${theme.name}": ${updated.final_role_discord_id || 'NULL'}`);
    }

    console.log('\n='.repeat(80));
    console.log(`\n✅ TERMINÉ: ${updatedCount}/${themes.length} thème(s) mis à jour avec succès!\n`);

    if (updatedCount === themes.length) {
      console.log('💡 PROCHAINES ÉTAPES:\n');
      console.log('   1. Les nouveaux thèmes créés fonctionneront automatiquement');
      console.log('   2. Les thèmes existants utiliseront maintenant les IDs de rôles');
      console.log('   3. L\'attribution automatique devrait fonctionner correctement\n');
      console.log('🧪 POUR TESTER:');
      console.log('   - Sur le serveur de test, complète une collection');
      console.log('   - Vérifie que le rôle est bien attribué automatiquement\n');
    }

    console.log('='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

updateRoleIds();
