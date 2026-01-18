# Endpoints API - Référence Complète

## Theme-Builder Routes (consommées/exposées)

### Authentication

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/discord` | GET | Initie OAuth2 Discord |
| `/api/auth/discord/callback` | GET | Callback OAuth2 |
| `/api/auth/logout` | POST | Déconnexion |
| `/api/auth/me` | GET | Info utilisateur connecté |

### Guild Management

| Endpoint | Méthode | Payload | Description |
|----------|---------|---------|-------------|
| `/api/guild/:guildId/config` | GET | - | Récupère config serveur |
| `/api/guild/:guildId/config` | PUT | `{prefix, language, ...}` | Met à jour config |
| `/api/guild/:guildId/branding` | GET | - | Récupère branding |
| `/api/guild/:guildId/branding` | PUT | `{banner_url, color, ...}` | Met à jour branding |

### Themes

| Endpoint | Méthode | Payload | Description |
|----------|---------|---------|-------------|
| `/api/guild/:guildId/themes` | GET | - | Liste thèmes serveur |
| `/api/guild/:guildId/themes` | POST | Theme JSON | Crée nouveau thème |
| `/api/guild/:guildId/themes/:id` | GET | - | Détail d'un thème |
| `/api/guild/:guildId/themes/:id` | PUT | Theme JSON | Met à jour thème |
| `/api/guild/:guildId/themes/:id` | DELETE | - | Supprime thème |
| `/api/guild/:guildId/themes/:id/activate` | POST | - | Active le thème |

### Collectibles

| Endpoint | Méthode | Payload | Description |
|----------|---------|---------|-------------|
| `/api/guild/:guildId/collectibles` | GET | - | Liste collectibles |
| `/api/guild/:guildId/collectibles` | POST | `{name, rarity, emoji, ...}` | Crée collectible |
| `/api/guild/:guildId/collectibles/:id` | PUT | `{name, rarity, ...}` | Met à jour |
| `/api/guild/:guildId/collectibles/:id` | DELETE | - | Supprime |

### Traps

| Endpoint | Méthode | Payload | Description |
|----------|---------|---------|-------------|
| `/api/guild/:guildId/traps` | GET | - | Liste pièges |
| `/api/guild/:guildId/traps` | POST | `{name, effect, duration, ...}` | Crée piège |
| `/api/guild/:guildId/traps/:id` | PUT | `{name, effect, ...}` | Met à jour |
| `/api/guild/:guildId/traps/:id` | DELETE | - | Supprime |

### Missions

| Endpoint | Méthode | Payload | Description |
|----------|---------|---------|-------------|
| `/api/guild/:guildId/missions` | GET | - | Liste missions |
| `/api/guild/:guildId/missions` | POST | `{name, type, reward_type, ...}` | Crée mission |
| `/api/guild/:guildId/missions/:id` | PUT | `{name, type, ...}` | Met à jour |
| `/api/guild/:guildId/missions/:id` | DELETE | - | Supprime |

### Players (lecture seule)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/guild/:guildId/players` | GET | Liste joueurs |
| `/api/guild/:guildId/players/:id` | GET | Détail joueur |
| `/api/guild/:guildId/players/:id/progress` | GET | Progression joueur |

### Campaigns

| Endpoint | Méthode | Payload | Description |
|----------|---------|---------|-------------|
| `/api/guild/:guildId/campaigns` | GET | - | Liste campagnes |
| `/api/guild/:guildId/campaigns` | POST | `{name, schedule, items, ...}` | Crée campagne |
| `/api/guild/:guildId/campaigns/:id` | PUT | `{name, schedule, ...}` | Met à jour |
| `/api/guild/:guildId/campaigns/:id` | DELETE | - | Supprime |

## Validation Schema

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/validate` | POST | Valide JSON contre schema |
| `/api/schema` | GET | Récupère le schema JSON |
| `/api/examples` | GET | Thèmes exemples (presets) |

## Codes d'Erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Créé avec succès |
| 400 | Payload invalide |
| 401 | Non authentifié |
| 403 | Accès refusé (pas admin/super admin) |
| 404 | Ressource non trouvée |
| 429 | Rate limit dépassé |
| 500 | Erreur serveur |
