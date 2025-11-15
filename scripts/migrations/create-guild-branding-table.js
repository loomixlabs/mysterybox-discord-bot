require('dotenv').config();
const db = require('../../utils/database-pg');

async function createGuildBrandingTable() {
  console.log('🔧 Création de la table guild_branding pour la configuration multi-serveur\n');
  console.log('━'.repeat(100));

  try {
    // 1. Créer la table guild_branding
    console.log('\n📊 ÉTAPE 1: Création de la table guild_branding\n');

    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_branding (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL UNIQUE,

        -- Branding
        bot_display_name TEXT DEFAULT 'MysteryBox by Loomix',
        primary_color TEXT DEFAULT '#3498db',
        secondary_color TEXT DEFAULT '#2ecc71',
        embed_footer_text TEXT DEFAULT 'MysteryBox by Loomix',
        embed_footer_icon_url TEXT,

        -- Paramètres
        language TEXT DEFAULT 'fr',
        timezone TEXT DEFAULT 'Europe/Paris',

        -- Modules activés (pour architecture plugin future)
        modules_enabled JSONB DEFAULT '["mysterybox"]'::jsonb,

        -- Métadonnées
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
      )
    `);

    console.log('   ✅ Table guild_branding créée\n');

    // 2. Créer l'index pour performance
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 2: Création de l\'index\n');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_guild_branding_guild_id
      ON guild_branding(guild_id)
    `);

    console.log('   ✅ Index créé\n');

    // 3. Créer la config personnalisée pour Monopoly Friends
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 3: Configuration de Monopoly Friends\n');

    const monopolyFriendsGuildId = '1248028543389143070';

    await db.query(`
      INSERT INTO guild_branding (
        guild_id,
        bot_display_name,
        primary_color,
        embed_footer_text
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (guild_id) DO NOTHING
    `, [
      monopolyFriendsGuildId,
      'Monopoly Friends give',
      '#3498db',
      'Monopoly Friends - Mystery Box Game'
    ]);

    console.log('   ✅ Configuration Monopoly Friends créée');
    console.log('      Nom: Monopoly Friends give');
    console.log('      Footer: Monopoly Friends - Mystery Box Game\n');

    // 4. Créer les configs par défaut pour les autres serveurs
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 4: Configuration par défaut pour autres serveurs\n');

    const result = await db.query(`
      INSERT INTO guild_branding (guild_id)
      SELECT guild_id FROM guild_config
      WHERE guild_id != $1
      ON CONFLICT (guild_id) DO NOTHING
    `, [monopolyFriendsGuildId]);

    console.log(`   ✅ ${result.rowCount} serveur(s) configuré(s) avec les valeurs par défaut\n`);

    // 5. Vérification
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 5: Vérification\n');

    const configs = await db.query(`
      SELECT guild_id, bot_display_name, embed_footer_text, primary_color
      FROM guild_branding
      ORDER BY guild_id
    `);

    console.log(`   Total de configurations: ${configs.length}\n`);
    configs.forEach(config => {
      console.log(`   - Guild: ${config.guild_id}`);
      console.log(`     Nom: ${config.bot_display_name}`);
      console.log(`     Couleur: ${config.primary_color}`);
      console.log(`     Footer: ${config.embed_footer_text}\n`);
    });

    console.log('━'.repeat(100));
    console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    throw error;
  } finally {
    await db.close();
  }
}

createGuildBrandingTable();
