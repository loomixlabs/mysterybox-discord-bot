---
name: api-contract
description: |
  Contrat API entre le bot Discord et le Theme-Builder dashboard.
  ACTIVE AUTOMATIQUEMENT quand:
  - Modification de routes API consommées par le theme-builder
  - Ajout/modification de tables partagées (themes, collectibles, guild_config)
  - Changement de format de données (JSON payloads)
  - Création d'endpoints que le dashboard utilisera

  Garantit: cohérence des payloads, documentation des endpoints, validation croisée.
  Projet miroir: c:\ia mogo\theme-builder\.claude\skills\api-contract
---

# API Contract - Bot Discord

## Mission

Maintenir la cohérence entre le bot Discord et le Theme-Builder dashboard.
Le Theme-Builder consomme les mêmes tables PostgreSQL que le bot.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Theme-Builder │   API   │   Bot Discord    │
│   (Dashboard)   │◄───────►│   (Backend)      │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         └───────────┬───────────────┘
                     ▼
              ┌──────────────┐
              │  PostgreSQL  │
              │  (Partagé)   │
              └──────────────┘
```

## Routes API du Theme-Builder

Le theme-builder expose ces routes qui manipulent les mêmes données que le bot:

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/guild/:guildId/config` | GET/PUT | Configuration serveur |
| `/api/guild/:guildId/themes` | GET/POST | Thèmes du serveur |
| `/api/guild/:guildId/collectibles` | GET/POST/PUT/DELETE | Items à collecter |
| `/api/guild/:guildId/traps` | GET/POST/PUT/DELETE | Pièges |
| `/api/guild/:guildId/missions` | GET/POST/PUT/DELETE | Missions |
| `/api/guild/:guildId/players` | GET | Joueurs du serveur |
| `/api/guild/:guildId/campaigns` | GET/POST | Campagnes programmées |

## Tables Partagées Critiques

Ces tables sont modifiées par les DEUX projets:

```sql
-- Configuration serveur
guild_config        -- Bot: lecture | Dashboard: lecture/écriture
guild_branding      -- Bot: lecture | Dashboard: écriture

-- Contenu thématique
themes              -- Bot: lecture/activation | Dashboard: CRUD complet
collectibles        -- Bot: lecture/attribution | Dashboard: CRUD
traps               -- Bot: déclenchement | Dashboard: CRUD
missions            -- Bot: validation | Dashboard: CRUD

-- Progression joueurs (lecture seule dashboard)
players             -- Bot: CRUD | Dashboard: lecture
player_progress     -- Bot: CRUD | Dashboard: lecture
collections         -- Bot: CRUD | Dashboard: lecture
```

## Checklist Avant Modification

```
□ La modification affecte-t-elle une table partagée?
□ Le format JSON reste-t-il compatible?
□ Le theme-builder doit-il être mis à jour?
□ Les validations sont-elles cohérentes?
```

## Patterns de Validation Croisée

### Ajouter une colonne à une table partagée

```javascript
// 1. Créer migration versionnée
// database/migrations/YYYY-MM-DD-add-column-xxx.sql
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS new_column TYPE DEFAULT value;

// 2. Mettre à jour DATABASE-SCHEMA.md

// 3. NOTIFIER: Le theme-builder doit aussi gérer cette colonne
// Voir: c:\ia mogo\theme-builder\routes\guild.js
```

### Modifier un payload JSON

```javascript
// AVANT de modifier la structure d'un theme JSON:
// 1. Vérifier schema: bot discord\themes\schema\theme.schema.json
// 2. Le theme-builder charge ce schema pour validation
// 3. Toute modification doit être rétro-compatible
```

## Références

- [endpoints.md](references/endpoints.md) - Documentation complète des endpoints
- [payloads.md](references/payloads.md) - Formats JSON attendus
