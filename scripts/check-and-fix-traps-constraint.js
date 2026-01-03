const db = require('../utils/database-pg');

async function checkAndFixTrapsConstraint() {
  try {
    console.log('🔍 DIAGNOSTIC - Contrainte UNIQUE sur traps\n');
    console.log('='.repeat(80));

    // 1. Vérifier les thèmes sur le serveur test
    console.log('\n📊 Thèmes sur serveur 297309737135898624:');
    const themes = await db.queryAll(`
      SELECT id, theme_id, name, is_active, created_at
      FROM themes
      WHERE guild_id = '297309737135898624'
      ORDER BY id DESC
    `);
    console.table(themes);

    // 2. Vérifier la contrainte UNIQUE actuelle sur traps
    console.log('\n📊 Contraintes UNIQUE sur table traps:');
    const constraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'traps'::regclass
      AND contype = 'u'
    `);
    console.table(constraints);

    // 3. Vérifier les pièges existants pour ce serveur
    console.log('\n📊 Pièges existants pour serveur 297309737135898624:');
    const traps = await db.queryAll(`
      SELECT id, theme_id, trap_id, name, type
      FROM traps
      WHERE guild_id = '297309737135898624'
      ORDER BY theme_id, trap_id
    `);
    console.table(traps);

    // 4. Le problème : la contrainte (guild_id, trap_id) ne permet pas les mêmes pièges sur différents thèmes
    console.log('\n🔴 PROBLÈME IDENTIFIÉ:');
    console.log('   La contrainte UNIQUE est (guild_id, trap_id)');
    console.log('   Elle devrait être (guild_id, theme_id, trap_id)');
    console.log('   Cela empêche la création des mêmes pièges par défaut sur différents thèmes du même serveur');

    // 5. Correction de la contrainte
    console.log('\n🔧 CORRECTION EN COURS...');

    // Supprimer l'ancienne contrainte
    try {
      await db.query(`ALTER TABLE traps DROP CONSTRAINT IF EXISTS traps_guild_id_trap_id_key`);
      console.log('✅ Ancienne contrainte supprimée');
    } catch (e) {
      console.log('⚠️  Contrainte déjà absente ou erreur:', e.message);
    }

    // Créer la nouvelle contrainte avec theme_id
    try {
      await db.query(`ALTER TABLE traps ADD CONSTRAINT traps_guild_id_theme_id_trap_id_key UNIQUE (guild_id, theme_id, trap_id)`);
      console.log('✅ Nouvelle contrainte créée: (guild_id, theme_id, trap_id)');
    } catch (e) {
      if (e.code === '42710') { // already exists
        console.log('⚠️  La nouvelle contrainte existe déjà');
      } else {
        console.error('❌ Erreur création contrainte:', e.message);
      }
    }

    // 6. Vérifier la nouvelle contrainte
    console.log('\n📊 Contraintes UNIQUE après correction:');
    const newConstraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'traps'::regclass
      AND contype = 'u'
    `);
    console.table(newConstraints);

    // 7. Maintenant créer les pièges manquants pour le thème 33
    console.log('\n🔧 Création des pièges manquants pour le thème 33...');
    const trapDefaults = require('../utils/trapDefaults');
    await trapDefaults.createDefaultTrapsForTheme('297309737135898624', 33);

    console.log('\n' + '='.repeat(80));
    console.log('✅ CORRECTION TERMINÉE');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkAndFixTrapsConstraint();
