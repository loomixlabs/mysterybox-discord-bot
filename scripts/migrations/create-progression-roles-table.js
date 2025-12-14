/**
 * Migration: Création de la table progression_roles
 * Nécessaire pour le système de rôles de progression par paliers
 */

const db = require('../../utils/database-pg');

async function migrate() {
  console.log('🔧 Migration: Création table progression_roles');
  console.log('='.repeat(60));

  try {
    // Vérifier si la table existe déjà
    const exists = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'progression_roles'
      ) as exists
    `);

    if (exists.exists) {
      console.log('✅ La table progression_roles existe déjà');
      process.exit(0);
    }

    // Créer la table
    await db.query(`
      CREATE TABLE progression_roles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        theme_id INTEGER NOT NULL,
        role_name VARCHAR(255) NOT NULL,
        discord_role_id VARCHAR(255),
        percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
        color VARCHAR(7),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_progression_roles_theme
          FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
        CONSTRAINT unique_progression_role_per_theme_percentage
          UNIQUE (guild_id, theme_id, percentage)
      )
    `);

    console.log('✅ Table progression_roles créée');

    // Créer les index
    await db.query(`
      CREATE INDEX idx_progression_roles_guild ON progression_roles(guild_id)
    `);
    await db.query(`
      CREATE INDEX idx_progression_roles_theme ON progression_roles(theme_id)
    `);

    console.log('✅ Index créés');

    // Vérifier la création
    const cols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'progression_roles'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Structure de la table:');
    for (const col of cols) {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }

    console.log('\n✅ Migration terminée avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

migrate();
