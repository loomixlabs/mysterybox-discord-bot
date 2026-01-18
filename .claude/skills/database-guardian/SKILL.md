---
name: database-guardian
description: |
  Expert PostgreSQL pour architecture multi-serveur (guild_id).
  ACTIVE AUTOMATIQUEMENT quand Claude:
  - Écrit des requêtes SQL (SELECT, INSERT, UPDATE, DELETE)
  - Crée ou modifie des tables
  - Travaille sur des migrations
  - Manipule des données joueurs/serveurs

  Garantit: isolation guild_id, requêtes sûres, migrations versionnées.
  CONSULTE DATABASE-SCHEMA.md avant toute modification.
---

# Database Guardian

## Mission
Garantir l'intégrité des données avec isolation multi-serveur parfaite.

## Règle d'Or

**TOUTE requête qui touche des données serveur DOIT inclure `guild_id`**

```javascript
// Extraire guild_id EN PREMIER
const guildId = interaction.guildId;

// CHAQUE requête inclut guild_id
WHERE guild_id = $X
```

## Avant Toute Modification DB

1. **LIRE** DATABASE-SCHEMA.md
2. **VÉRIFIER** que les colonnes existent
3. **CRÉER** une migration si nouvelle colonne/table

```bash
# Vérifier le schéma
node scripts/database-guardian/check-schema.js [table] [colonne]
```

## Templates de Requêtes Sûres

### SELECT

```javascript
// ✅ Simple
const player = await db.queryOne(`
  SELECT * FROM players
  WHERE discord_id = $1 AND guild_id = $2
`, [discordId, guildId]);

// ✅ Avec JOIN
const data = await db.queryAll(`
  SELECT p.*, c.item_id, col.name
  FROM players p
  JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id
  JOIN collectibles col ON col.id = c.item_id AND col.guild_id = c.guild_id
  WHERE p.guild_id = $1
`, [guildId]);
```

### INSERT

```javascript
// ✅ Simple
await db.query(`
  INSERT INTO players (discord_id, guild_id, username)
  VALUES ($1, $2, $3)
`, [discordId, guildId, username]);

// ✅ UPSERT (ON CONFLICT)
await db.query(`
  INSERT INTO collections (player_id, item_id, guild_id, quantity)
  VALUES ($1, $2, $3, 1)
  ON CONFLICT (player_id, item_id, guild_id)
  DO UPDATE SET quantity = collections.quantity + 1
`, [playerId, itemId, guildId]);
```

### UPDATE

```javascript
// ✅ TOUJOURS guild_id dans WHERE
await db.query(`
  UPDATE players
  SET points = points + $1
  WHERE id = $2 AND guild_id = $3
`, [points, playerId, guildId]);
```

### DELETE

```javascript
// ✅ TOUJOURS guild_id dans WHERE
await db.query(`
  DELETE FROM collections
  WHERE player_id = $1 AND item_id = $2 AND guild_id = $3
`, [playerId, itemId, guildId]);
```

## Créer une Migration

### Process

1. Créer fichier dans `database/migrations/`
2. Nommer: `YYYY-MM-DD-description.sql`
3. Inclure UP et DOWN
4. Exécuter via Node.js (jamais psql direct)

### Template Migration

```sql
-- Migration: add-column-xxx
-- Date: 2025-01-18
-- Description: Ajoute colonne xxx à table yyy

-- UP
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS new_column TYPE DEFAULT value;

-- DOWN (rollback)
-- ALTER TABLE table_name DROP COLUMN IF EXISTS new_column;
```

### Script d'Exécution

```javascript
// scripts/run-migration-xxx.js
const db = require('./utils/database-pg');

async function migrate() {
  console.log('🔄 Migration: description...');

  await db.query(`
    ALTER TABLE table_name
    ADD COLUMN IF NOT EXISTS new_column TYPE DEFAULT value
  `);

  console.log('✅ Migration terminée');
  process.exit(0);
}

migrate().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
```

## Tables Sans guild_id (Globales)

Ces tables sont partagées entre tous les serveurs:

- `colors` - Palette de couleurs
- `super_admins` - Admins globaux
- `themes_library` - Bibliothèque thèmes partagés

**Toutes les autres tables DOIVENT avoir guild_id**

## Contraintes CHECK Courantes

```sql
-- Raretés
CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))

-- Statuts
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'))

-- Types missions
CHECK (type IN ('keyword-message', 'reaction-message', 'quiz', ...))

-- Niveaux collectibles
CHECK (level >= 1 AND level <= 4)
```

## Vérification Avant Requête

Avant d'écrire une requête, pose-toi:

1. ☐ La table existe-t-elle? (Vérifie DATABASE-SCHEMA.md)
2. ☐ Les colonnes existent-elles?
3. ☐ guild_id est-il inclus?
4. ☐ Les contraintes CHECK sont-elles respectées?
5. ☐ Les FK existent-elles?

## Scripts Utiles

```bash
# Vérifier une table
node scripts/database-guardian/check-schema.js players

# Lister toutes les tables
node list-tables.js

# Vérifier schéma complet
node verify-db.js
```

## Références

- [schema-summary.md](references/schema-summary.md) - Résumé 80 tables
- [query-templates.md](references/query-templates.md) - Templates par système
- [DATABASE-SCHEMA.md](../../bot%20discord/DATABASE-SCHEMA.md) - Schéma complet
