/**
 * Migration VPS - Système Joker
 *
 * Ce script met à jour:
 * 1. La contrainte CHECK sur collections.source pour inclure 'joker'
 * 2. La colonne super_bonus_joker_used dans announcement_settings
 * 3. Le template d'annonce joker pour tous les serveurs
 *
 * À exécuter sur le VPS: node scripts/migration-joker-system-vps.js
 */
const db = require('../utils/database-pg');

async function migrate() {
  console.log('🃏 MIGRATION VPS - SYSTÈME MYSTERYBOX JOKER\n');
  console.log('='.repeat(70));

  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1. MISE À JOUR CONTRAINTE collections.source
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 1. MISE À JOUR CONTRAINTE collections.source');
    console.log('─'.repeat(50));

    // Supprimer toute contrainte existante
    const constraints = await db.queryAll(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'collections'::regclass AND contype = 'c'
    `);

    for (const c of constraints) {
      await db.query(`ALTER TABLE collections DROP CONSTRAINT IF EXISTS ${c.conname}`);
      console.log(`   ✅ Contrainte ${c.conname} supprimée`);
    }

    // Ajouter la nouvelle contrainte avec 'joker'
    await db.query(`
      ALTER TABLE collections ADD CONSTRAINT collections_source_check
      CHECK (source IN ('give', 'mystery_box', 'mission', 'admin_give', 'trade', 'reroll', 'joker', 'campaign'))
    `);
    console.log('   ✅ Nouvelle contrainte ajoutée avec "joker"');

    // ═══════════════════════════════════════════════════════════════════
    // 2. COLONNE announcement_settings.super_bonus_joker_used
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 2. COLONNE announcement_settings.super_bonus_joker_used');
    console.log('─'.repeat(50));

    const columnExists = await db.queryOne(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      AND column_name = 'super_bonus_joker_used'
    `);

    if (columnExists) {
      console.log('   ✅ Colonne existe déjà');
    } else {
      await db.query(`
        ALTER TABLE announcement_settings
        ADD COLUMN IF NOT EXISTS super_bonus_joker_used BOOLEAN DEFAULT TRUE
      `);
      console.log('   ✅ Colonne ajoutée');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. TEMPLATE D'ANNONCE JOKER POUR TOUS LES SERVEURS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 3. TEMPLATE D\'ANNONCE JOKER');
    console.log('─'.repeat(50));

    // Récupérer tous les guilds
    const guilds = await db.queryAll(`SELECT DISTINCT guild_id FROM themes`);
    console.log(`   ${guilds.length} serveur(s) trouvé(s)`);

    const template = {
      type: 'super_bonus_joker_used',
      title: '🃏✨ MYSTERYBOX JOKER UTILISÉ ✨🃏',
      description: `╔═══════════════════════════════════╗
║  🎰 **BONUS LÉGENDAIRE ACTIVÉ** 🎰  ║
╚═══════════════════════════════════╝

**{userName}** a utilisé son **MysteryBox Joker** !

🎁 Collectible choisi:
╭─────────────────────────╮
│  ✨ **{collectibleName}**
│  📊 Rareté: **{collectibleRarity}**
╰─────────────────────────╯

*Le pouvoir du Joker a été consommé !*`,
      color: '#FFD700',
      footer_text: '🃏 MysteryBox Joker • Bonus Légendaire'
    };

    let created = 0;
    let skipped = 0;

    for (const guild of guilds) {
      const exists = await db.queryOne(`
        SELECT id FROM announcement_templates
        WHERE guild_id = $1 AND type = 'super_bonus_joker_used'
      `, [guild.guild_id]);

      if (exists) {
        skipped++;
        continue;
      }

      await db.query(`
        INSERT INTO announcement_templates (
          guild_id, type, title, description, color, footer_text
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        guild.guild_id,
        template.type,
        template.title,
        template.description,
        template.color,
        template.footer_text
      ]);
      created++;
    }

    console.log(`   ✅ ${created} template(s) créé(s), ${skipped} déjà existant(s)`);

    // ═══════════════════════════════════════════════════════════════════
    // 4. VÉRIFICATION FINALE
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📋 4. VÉRIFICATION FINALE');
    console.log('─'.repeat(50));

    // Vérifier contrainte
    const constraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'collections_source_check'
    `);
    console.log(`   Contrainte: ${constraint?.definition ? '✅ OK' : '❌ MANQUANTE'}`);

    // Vérifier colonne
    const col = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'announcement_settings' AND column_name = 'super_bonus_joker_used'
    `);
    console.log(`   Colonne settings: ${col ? '✅ OK' : '❌ MANQUANTE'}`);

    // Compter templates
    const templateCount = await db.queryOne(`
      SELECT COUNT(*) as count FROM announcement_templates WHERE type = 'super_bonus_joker_used'
    `);
    console.log(`   Templates joker: ${templateCount.count}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS !');
    console.log('\n💡 N\'oubliez pas de redémarrer le bot pour appliquer les changements.');
    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

migrate();
