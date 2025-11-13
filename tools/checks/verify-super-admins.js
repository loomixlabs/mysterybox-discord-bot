const db = require('./utils/database-pg');

async function verify() {
  try {
    console.log('🔍 VÉRIFICATION SUPER ADMINS\n');
    console.log('='.repeat(80));

    // Récupérer tous les super admins
    const superAdmins = await db.queryAll('SELECT * FROM super_admins');

    console.log(`\n📋 Super admins trouvés: ${superAdmins.length}\n`);

    if (superAdmins.length === 0) {
      console.log('⚠️  AUCUN SUPER ADMIN TROUVÉ !');
      console.log('\n💡 Ajouter les super admins avec:');
      console.log('INSERT INTO super_admins (discord_id, username) VALUES');
      console.log('  (\'297307186307006464\', \'Super Admin 1\'),');
      console.log('  (\'340981911281205248\', \'Super Admin 2\');');
    } else {
      console.table(superAdmins.map(sa => ({
        ID: sa.id,
        'Discord ID': sa.discord_id,
        Username: sa.username,
        'Créé le': sa.created_at
      })));

      console.log('\n✅ IDs ATTENDUS:');
      console.log('  • 297307186307006464 (Super Admin 1)');
      console.log('  • 340981911281205248 (Super Admin 2 - Associé)');

      console.log('\n🔍 VÉRIFICATION:');
      const hasAdmin1 = superAdmins.find(sa => sa.discord_id === '297307186307006464');
      const hasAdmin2 = superAdmins.find(sa => sa.discord_id === '340981911281205248');
      const hasOldAdmin = superAdmins.find(sa => sa.discord_id === '1248027211689234535');

      console.log(`  ✅ Admin 1 (297307186307006464): ${hasAdmin1 ? 'PRÉSENT' : '❌ MANQUANT'}`);
      console.log(`  ✅ Admin 2 (340981911281205248): ${hasAdmin2 ? 'PRÉSENT' : '❌ MANQUANT'}`);
      console.log(`  ${hasOldAdmin ? '⚠️  ANCIEN ID (1248027211689234535): À SUPPRIMER !' : '✅ Ancien ID non présent'}`);

      if (hasOldAdmin) {
        console.log('\n⚠️  ACTION REQUISE: Supprimer l\'ancien super admin avec:');
        console.log('DELETE FROM super_admins WHERE discord_id = \'1248027211689234535\';');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

verify();
