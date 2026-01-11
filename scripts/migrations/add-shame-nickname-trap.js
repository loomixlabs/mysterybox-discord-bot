/**
 * Migration: Ajouter le piège "Shame Nickname" (Pseudo Honteux)
 *
 * Ce script:
 * 1. Met à jour la contrainte CHECK pour ajouter 'shame-nickname' comme type valide
 * 2. Ajoute une colonne shame_nicknames dans guild_config pour stocker les pseudos configurables
 * 3. Crée une table player_shame_nickname pour tracker les joueurs piégés
 * 4. Ajoute un piège par défaut pour chaque thème actif
 */

require('dotenv').config();
const db = require('../../utils/database-pg');

const DEFAULT_SHAME_NICKNAMES = [
  '🐔 Poulet Piégé',
  '🤡 Clown du Serveur',
  '💩 Victime du Jour',
  '🐌 Escargot Lent',
  '🦆 Canard Malchanceux',
  '🐷 Petit Cochon',
  '🐸 Grenouille Piégée',
  '🦝 Raton Râleur'
];

async function runMigration() {
  console.log('🚀 Migration: Ajout du piège "Shame Nickname"\n');
  console.log('='.repeat(60));

  try {
    // Étape 1: Modifier la contrainte CHECK sur la colonne type
    console.log('\n📋 Étape 1: Mise à jour de la contrainte CHECK...');

    // Supprimer l'ancienne contrainte
    await db.query(`
      ALTER TABLE traps DROP CONSTRAINT IF EXISTS traps_type_check
    `);

    // Ajouter la nouvelle contrainte avec 'shame-nickname'
    await db.query(`
      ALTER TABLE traps ADD CONSTRAINT traps_type_check
      CHECK (type = ANY (ARRAY[
        'cooldown'::text,
        'lose-collectible'::text,
        'lose-all-collectibles'::text,
        'public-shame'::text,
        'points-malus'::text,
        'empty-box'::text,
        'shame-nickname'::text
      ]))
    `);
    console.log('✅ Contrainte CHECK mise à jour');

    // Étape 2: Ajouter la colonne shame_nicknames dans guild_config
    console.log('\n📋 Étape 2: Ajout de la colonne shame_nicknames dans guild_config...');

    const columnExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'guild_config' AND column_name = 'shame_nicknames'
    `);

    if (!columnExists) {
      await db.query(`
        ALTER TABLE guild_config
        ADD COLUMN shame_nicknames jsonb DEFAULT '${JSON.stringify(DEFAULT_SHAME_NICKNAMES)}'::jsonb
      `);
      console.log('✅ Colonne shame_nicknames ajoutée');
    } else {
      console.log('⏭️  Colonne shame_nicknames existe déjà');
    }

    // Étape 3: Créer la table player_shame_nickname pour tracker les joueurs piégés
    console.log('\n📋 Étape 3: Création de la table player_shame_nickname...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS player_shame_nickname (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        original_nickname TEXT,
        shame_nickname TEXT NOT NULL,
        trap_id INTEGER REFERENCES traps(id),
        started_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        attempts_to_change INTEGER DEFAULT 0,
        UNIQUE(guild_id, player_id, is_active)
      )
    `);

    // Créer les index
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_shame_nickname_guild ON player_shame_nickname(guild_id);
      CREATE INDEX IF NOT EXISTS idx_shame_nickname_active ON player_shame_nickname(is_active) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_shame_nickname_expires ON player_shame_nickname(expires_at) WHERE is_active = TRUE;
    `);
    console.log('✅ Table player_shame_nickname créée avec index');

    // Étape 4: Ajouter la colonne shame_nicknames dans traps (par piège/thème)
    console.log('\n📋 Étape 4: Ajout colonne shame_nicknames dans traps...');

    const trapNicknamesColumnExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'traps' AND column_name = 'shame_nicknames'
    `);

    if (!trapNicknamesColumnExists) {
      await db.query(`
        ALTER TABLE traps
        ADD COLUMN shame_nicknames jsonb DEFAULT NULL
      `);
      console.log('✅ Colonne shame_nicknames ajoutée dans traps');
    } else {
      console.log('⏭️  Colonne shame_nicknames existe déjà dans traps');
    }

    console.log('💡 Note: La durée utilise cooldown_duration (en minutes)');

    // Étape 5: Ajouter l'annonce dans announcement_settings
    console.log('\n📋 Étape 5: Ajout toggle annonce trap_shame_nickname...');

    const announcementColumnExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'announcement_settings' AND column_name = 'trap_shame_nickname'
    `);

    if (!announcementColumnExists) {
      await db.query(`
        ALTER TABLE announcement_settings
        ADD COLUMN trap_shame_nickname BOOLEAN DEFAULT TRUE
      `);
      console.log('✅ Colonne trap_shame_nickname ajoutée dans announcement_settings');
    } else {
      console.log('⏭️  Colonne trap_shame_nickname existe déjà');
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
    console.log('='.repeat(60));
    console.log('\n📝 Résumé des changements:');
    console.log('   - Contrainte CHECK mise à jour (ajout shame-nickname)');
    console.log('   - Colonne shame_nicknames dans guild_config');
    console.log('   - Table player_shame_nickname créée');
    console.log('   - Toggle annonce trap_shame_nickname ajouté');
    console.log('\n📌 Prochaines étapes:');
    console.log('   1. Exécuter le script de seed pour créer les pièges par défaut');
    console.log('   2. Ajouter la logique dans mysteryBoxHandler');
    console.log('   3. Ajouter l\'événement guildMemberUpdate');
    console.log('   4. Configurer l\'admin panel');

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR DE MIGRATION:', error);
    process.exit(1);
  }
}

runMigration();
