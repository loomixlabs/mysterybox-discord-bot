/**
 * Vérifie que les migrations du système Joker sont bien en place
 */
const db = require('../utils/database-pg');

async function verify() {
  console.log('\n🃏 VÉRIFICATION MIGRATIONS SYSTÈME JOKER\n');
  console.log('='.repeat(60));

  try {
    // 1. Colonne announcement_settings.super_bonus_joker_used
    console.log('\n📋 1. Colonne announcement_settings.super_bonus_joker_used');
    console.log('─'.repeat(50));
    const col = await db.queryOne(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      AND column_name = 'super_bonus_joker_used'
    `);

    if (col) {
      console.log(`   ✅ Existe - Type: ${col.data_type}, Default: ${col.column_default}`);
    } else {
      console.log('   ❌ MANQUANTE - Nécessite migration');
    }

    // 2. Contrainte collections.source avec 'joker'
    console.log('\n📋 2. Contrainte collections.source');
    console.log('─'.repeat(50));
    const constraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'collections_source_check'
    `);

    if (constraint) {
      console.log(`   ${constraint.definition}`);
      if (constraint.definition.includes("'joker'")) {
        console.log("   ✅ 'joker' est inclus dans la contrainte");
      } else {
        console.log("   ❌ 'joker' n'est PAS dans la contrainte - Nécessite migration");
      }
    } else {
      console.log('   ❌ Contrainte MANQUANTE');
    }

    // 3. Template super_bonus_joker_used pour tous les serveurs
    console.log('\n📋 3. Templates super_bonus_joker_used');
    console.log('─'.repeat(50));
    const templates = await db.queryAll(`
      SELECT guild_id, title
      FROM announcement_templates
      WHERE type = 'super_bonus_joker_used'
    `);

    console.log(`   ${templates.length} template(s) trouvé(s)`);
    for (const t of templates) {
      console.log(`   • Serveur ${t.guild_id}: "${t.title}"`);
    }

    // 4. Serveurs sans template joker
    console.log('\n📋 4. Serveurs sans template joker');
    console.log('─'.repeat(50));
    const missing = await db.queryAll(`
      SELECT DISTINCT t.guild_id
      FROM themes t
      WHERE NOT EXISTS (
        SELECT 1 FROM announcement_templates at
        WHERE at.guild_id = t.guild_id AND at.type = 'super_bonus_joker_used'
      )
    `);

    if (missing.length === 0) {
      console.log('   ✅ Tous les serveurs ont le template');
    } else {
      console.log(`   ⚠️  ${missing.length} serveur(s) sans template:`);
      for (const m of missing) {
        console.log(`   • ${m.guild_id}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Vérification terminée\n');
    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

verify();
