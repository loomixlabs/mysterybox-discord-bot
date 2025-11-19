# 📊 DATABASE SCHEMA - Bot Discord Multi-Serveur

> **Dernière analyse**: 2025-11-18
> **Total tables**: 33 tables
> **SGBD**: PostgreSQL 16+
> **Architecture**: Multi-serveur avec `guild_id` obligatoire

---

## 🎯 Vue d'Ensemble

Cette base de données supporte un bot Discord gamifié multi-serveur. **TOUTES les tables (sauf configuration globale) DOIVENT inclure `guild_id` pour l'isolation des données par serveur.**

### Tables par Catégorie

```
📋 Configuration Serveur (5 tables)
   └─ guild_config, guild_admin_roles, guild_branding, guild_stats, colors

🎨 Thèmes & Collectibles (5 tables)
   └─ themes, theme_config, theme_messages, collectibles, collections

🎁 Mystery Boxes & Gives (3 tables)
   └─ give_campaigns, give_channels, give_logs

⚠️ Pièges (2 tables)
   └─ traps, trap_triggered

🎯 Missions & Quiz (4 tables)
   └─ missions, mission_progress, mission_keywords, quiz_questions

👤 Joueurs (5 tables)
   └─ players, player_progress, player_cooldowns, player_malus_points, player_active_bonuses

💎 Super Bonus System (2 tables)
   └─ super_bonuses, bonus_usage_history

📢 Système d'Annonces (3 tables)
   └─ announcement_channel, announcement_settings, announcement_templates

👑 Super Admin (2 tables)
   └─ super_admins, super_admin_logs

📝 Audit & Logs (1 table)
   └─ audit_logs

🎮 Mini-Jeux (1 table)
   └─ apple_game_winners
```

---

## 📋 TABLES DE CONFIGURATION SERVEUR

### `guild_config`
**Rôle**: Configuration principale par serveur (point central, toutes les FK pointent ici)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `guild_id` | TEXT | PK, NOT NULL | Discord Guild ID |
| `bot_role_id` | TEXT | | Rôle attribué par le bot |
| `bot_status` | TEXT | DEFAULT 'active' | Statut du bot: active/maintenance |
| `created_at` | TIMESTAMP | DEFAULT now() | Date de création |

**Clé Primaire**: `guild_id`
**Utilisée par**: Presque toutes les tables (FK)
**Index**: Aucun index supplémentaire nécessaire (PK est indexée)

---

### `guild_admin_roles`
**Rôle**: Rôles Discord autorisés à utiliser les commandes admin

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `role_id` | TEXT | NOT NULL | Discord Role ID |
| `role_name` | TEXT | NOT NULL | Nom du rôle |
| `created_at` | TIMESTAMP | DEFAULT now() | Date d'ajout |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`
**Index**: Automatique sur `id`

---

### `guild_branding`
**Rôle**: Personnalisation visuelle du bot par serveur (footer, logo)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `guild_id` | TEXT | PK, FK → guild_config | Guild associé |
| `footer_text` | TEXT | | Texte du footer |
| `footer_icon_url` | TEXT | | URL icône footer |
| `logo_url` | TEXT | | URL du logo serveur |
| `accent_color` | TEXT | | Couleur hex (#RRGGBB) |
| `created_at` | TIMESTAMP | DEFAULT now() | Date de création |
| `updated_at` | TIMESTAMP | DEFAULT now() | Dernière mise à jour |

**Clé Primaire**: `guild_id`
**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

---

### `guild_stats`
**Rôle**: Statistiques globales du serveur

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `total_players` | INTEGER | DEFAULT 0 | Nombre total de joueurs |
| `total_mystery_boxes_opened` | INTEGER | DEFAULT 0 | Mystery boxes ouvertes |
| `total_missions_completed` | INTEGER | DEFAULT 0 | Missions complétées |
| `total_collectibles_found` | INTEGER | DEFAULT 0 | Collectibles trouvés |
| `total_traps_triggered` | INTEGER | DEFAULT 0 | Pièges déclenchés |
| `last_updated` | TIMESTAMP | DEFAULT now() | Dernière MAJ |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

---

### `colors`
**Rôle**: Palette de couleurs pour personnalisation profils joueurs

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `name` | TEXT | NOT NULL, UNIQUE | Nom de la couleur |
| `hex_code` | TEXT | NOT NULL, UNIQUE | Code hex (#RRGGBB) |
| `emoji` | TEXT | | Emoji représentant la couleur |
| `category` | TEXT | | Catégorie (red, blue, etc.) |
| `created_at` | TIMESTAMP | DEFAULT now() | Date d'ajout |

**Contraintes UNIQUE**: `name`, `hex_code`
**Note**: Table globale (pas de `guild_id`), partagée entre serveurs

---

## 🎨 TABLES THÈMES & COLLECTIBLES

### `themes`
**Rôle**: Thématiques saisonnières (Blanche-Neige, Noël, etc.)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `name` | TEXT | NOT NULL | Nom du thème |
| `description` | TEXT | | Description |
| `is_active` | BOOLEAN | DEFAULT false | Thème actif? |
| `start_date` | TIMESTAMP | | Date de début |
| `end_date` | TIMESTAMP | | Date de fin |
| `required_collectibles` | INTEGER | DEFAULT 0 | Nombre pour compléter |
| `reward_role_id` | TEXT | | Rôle Discord récompense |
| `image_url` | TEXT | | Image du thème |
| `created_at` | TIMESTAMP | DEFAULT now() | Date de création |
| `updated_at` | TIMESTAMP | DEFAULT now() | Dernière MAJ |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`
**Note**: Un seul thème `is_active = true` par `guild_id` à la fois

---

### `theme_config`
**Rôle**: Configuration probabilités mystery boxes et types de contenu

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `theme_id` | INTEGER | FK → themes | Thème associé |
| `mystery_box_collectible` | INTEGER | DEFAULT 40 | % collectible |
| `mystery_box_trap` | INTEGER | DEFAULT 30 | % piège |
| `mystery_box_bonus` | INTEGER | DEFAULT 0 | % super bonus (v1.4.0+) |
| `mystery_box_empty` | INTEGER | DEFAULT 30 | % vide |
| `collectible_rarity_legendary` | INTEGER | DEFAULT 5 | % legendary |
| `collectible_rarity_epic` | INTEGER | DEFAULT 10 | % epic |
| `collectible_rarity_rare` | INTEGER | DEFAULT 20 | % rare |
| `collectible_rarity_common` | INTEGER | DEFAULT 40 | % common |
| `super_bonus_rarity_legendary` | INTEGER | DEFAULT 5 | % legendary bonus |
| `super_bonus_rarity_epic` | INTEGER | DEFAULT 15 | % epic bonus |
| `super_bonus_rarity_rare` | INTEGER | DEFAULT 30 | % rare bonus |
| `super_bonus_rarity_common` | INTEGER | DEFAULT 50 | % common bonus |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `theme_id` → `themes(id)`

**Validation**: Total des % par catégorie doit = 100%

---

### `theme_messages`
**Rôle**: Messages personnalisables par thème

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `theme_id` | INTEGER | FK → themes | Thème associé |
| `message_type` | TEXT | NOT NULL | Type: welcome, collection_completed, etc. |
| `content` | TEXT | NOT NULL | Contenu du message |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `theme_id` → `themes(id)`

---

### `collectibles`
**Rôle**: Items à collecter dans le thème actif

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `theme_id` | INTEGER | FK → themes | Thème associé |
| `name` | TEXT | NOT NULL | Nom du collectible |
| `description` | TEXT | | Description |
| `rarity` | TEXT | NOT NULL | legendary/epic/rare/common |
| `image_url` | TEXT | | Image du collectible |
| `emoji` | TEXT | | Emoji Discord |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `theme_id` → `themes(id)`

**Contrainte CHECK**: `rarity IN ('legendary', 'epic', 'rare', 'common')`

---

### `collections`
**Rôle**: Collectibles possédés par les joueurs

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `player_id` | INTEGER | FK → players | Joueur |
| `collectible_id` | INTEGER | FK → collectibles | Collectible |
| `collected_at` | TIMESTAMP | DEFAULT now() | Date d'obtention |
| `lost_at` | TIMESTAMP | | Date de perte (piège) |
| `source` | TEXT | DEFAULT 'mystery_box' | Source d'obtention |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `player_id` → `players(id)`
- `collectible_id` → `collectibles(id)`

**Contrainte CHECK**: `source IN ('mystery_box', 'mission', 'trade', 'admin_give', 'bonus_jackpot')`

**Contrainte UNIQUE**: `(guild_id, player_id, collectible_id)` (un seul exemplaire par joueur)

**Note v1.4.0+**: Utilise `INSERT ... ON CONFLICT DO UPDATE` pour gérer récupération après perte

---

## 🎁 TABLES MYSTERY BOXES & GIVES

### `give_campaigns`
**Rôle**: Campagnes programmées de distribution automatique

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `name` | TEXT | NOT NULL | Nom de la campagne |
| `content_type` | TEXT | NOT NULL | collectible/trap/bonus |
| `content_id` | INTEGER | | ID du contenu |
| `schedule_type` | TEXT | NOT NULL | once/hourly/daily/weekly |
| `schedule_time` | TIMESTAMP | | Pour 'once' |
| `cron_expression` | TEXT | | Pour recurring |
| `channel_mode` | TEXT | NOT NULL | random/specific |
| `is_active` | BOOLEAN | DEFAULT true | Campagne active? |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `started_at` | TIMESTAMP | | Début effectif |
| `ended_at` | TIMESTAMP | | Fin effective |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`
**Contrainte CHECK**: `content_type IN ('collectible', 'trap', 'bonus', 'empty')`
**Contrainte CHECK**: `schedule_type IN ('once', 'hourly', 'daily', 'weekly')`
**Contrainte CHECK**: `channel_mode IN ('random', 'specific')`

---

### `give_channels`
**Rôle**: Canaux associés à une campagne (si channel_mode = 'specific')

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `campaign_id` | INTEGER | FK → give_campaigns | Campagne |
| `channel_id` | TEXT | NOT NULL | Discord Channel ID |
| `channel_name` | TEXT | | Nom du canal |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `campaign_id` → `give_campaigns(id)`

---

### `give_logs`
**Rôle**: Historique de toutes les distributions (mystery boxes, gives admin)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `channel_id` | TEXT | NOT NULL | Canal Discord |
| `message_id` | TEXT | | ID message Discord |
| `content_type` | TEXT | NOT NULL | Type de contenu |
| `content_id` | INTEGER | | ID du contenu |
| `given_by` | TEXT | | Admin qui a donné |
| `campaign_id` | INTEGER | | Campagne associée |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

---

## ⚠️ TABLES PIÈGES

### `traps`
**Rôle**: Définition des pièges par thème

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `theme_id` | INTEGER | FK → themes | Thème associé |
| `name` | TEXT | NOT NULL | Nom du piège |
| `description` | TEXT | | Description |
| `effect_type` | TEXT | NOT NULL | Type d'effet |
| `effect_value` | TEXT | | Valeur de l'effet |
| `image_url` | TEXT | | Image du piège |
| `emoji` | TEXT | | Emoji Discord |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `theme_id` → `themes(id)`

**Contrainte CHECK**: `effect_type IN ('cooldown', 'lose_collectible', 'public_shame', 'malus_points', 'empty_box', 'lose_all_collectibles')`

---

### `trap_triggered`
**Rôle**: Historique des pièges activés par les joueurs

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `player_id` | INTEGER | FK → players | Joueur |
| `trap_id` | INTEGER | FK → traps | Piège |
| `triggered_at` | TIMESTAMP | DEFAULT now() | Date d'activation |
| `effect_applied` | TEXT | | Effet réellement appliqué |
| `details` | JSONB | | Détails supplémentaires |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `player_id` → `players(id)`
- `trap_id` → `traps(id)`

---

## 🎯 TABLES MISSIONS & QUIZ

### `missions`
**Rôle**: Définition des missions par thème

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `theme_id` | INTEGER | FK → themes | Thème associé |
| `name` | TEXT | NOT NULL | Nom de la mission |
| `description` | TEXT | | Description |
| `type` | TEXT | NOT NULL | quiz/keyword/channel_based |
| `difficulty` | TEXT | | easy/medium/hard |
| `reward_type` | TEXT | NOT NULL | collectible/trap |
| `reward_id` | INTEGER | | ID de la récompense |
| `channel_id` | TEXT | | Pour channel_based |
| `cooldown_hours` | INTEGER | DEFAULT 0 | Cooldown entre tentatives |
| `max_attempts` | INTEGER | | Tentatives max |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `theme_id` → `themes(id)`

**Contrainte CHECK**: `type IN ('quiz', 'keyword', 'channel_based')`
**Contrainte CHECK**: `difficulty IN ('easy', 'medium', 'hard')`
**Contrainte CHECK**: `reward_type IN ('collectible', 'trap')`

---

### `mission_progress`
**Rôle**: Progression des joueurs sur les missions

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `player_id` | INTEGER | FK → players | Joueur |
| `mission_id` | INTEGER | FK → missions | Mission |
| `status` | TEXT | NOT NULL | in_progress/completed/failed/pending_approval |
| `started_at` | TIMESTAMP | DEFAULT now() | Début |
| `completed_at` | TIMESTAMP | | Complétion |
| `attempts` | INTEGER | DEFAULT 0 | Nombre de tentatives |
| `thread_id` | TEXT | | Discord Thread ID (validation admin) |
| `proof_url` | TEXT | | URL preuve (capture) |
| `admin_notes` | TEXT | | Notes admin |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `player_id` → `players(id)`
- `mission_id` → `missions(id)`

**Contrainte CHECK**: `status IN ('in_progress', 'completed', 'failed', 'pending_approval')`

---

### `mission_keywords`
**Rôle**: Mots-clés de validation pour missions type 'keyword'

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `mission_id` | INTEGER | FK → missions | Mission |
| `keyword` | TEXT | NOT NULL | Mot-clé (insensible casse) |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `mission_id` → `missions(id)`

---

### `quiz_questions`
**Rôle**: Questions pour missions type 'quiz'

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `mission_id` | INTEGER | FK → missions | Mission |
| `question` | TEXT | NOT NULL | Question |
| `correct_answer` | TEXT | NOT NULL | Réponse correcte |
| `wrong_answer_1` | TEXT | NOT NULL | Mauvaise réponse 1 |
| `wrong_answer_2` | TEXT | NOT NULL | Mauvaise réponse 2 |
| `wrong_answer_3` | TEXT | NOT NULL | Mauvaise réponse 3 |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `mission_id` → `missions(id)`

---

## 👤 TABLES JOUEURS

### `players`
**Rôle**: Joueurs inscrits sur le serveur

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID interne |
| `discord_id` | TEXT | NOT NULL | Discord User ID |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `username` | TEXT | NOT NULL | Nom d'utilisateur Discord |
| `profile_color` | TEXT | | Couleur profil (#RRGGBB) |
| `created_at` | TIMESTAMP | DEFAULT now() | Inscription |
| `updated_at` | TIMESTAMP | DEFAULT now() | Dernière MAJ |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`
**Contrainte UNIQUE**: `(discord_id, guild_id)` - Un joueur par serveur

---

### `player_progress`
**Rôle**: Progression par joueur et par thème

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `player_id` | INTEGER | FK → players | Joueur |
| `theme_id` | INTEGER | FK → themes | Thème |
| `collectibles_count` | INTEGER | DEFAULT 0 | Collectibles possédés |
| `mystery_boxes_opened` | INTEGER | DEFAULT 0 | Mystery boxes ouvertes |
| `missions_completed` | INTEGER | DEFAULT 0 | Missions complétées |
| `traps_triggered` | INTEGER | DEFAULT 0 | Pièges activés |
| `malus_points` | INTEGER | DEFAULT 0 | Points malus |
| `has_completed_collection` | BOOLEAN | DEFAULT false | Collection complète? |
| `collection_completed_at` | TIMESTAMP | | Date complétion |
| `last_activity` | TIMESTAMP | DEFAULT now() | Dernière activité |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `player_id` → `players(id)`
- `theme_id` → `themes(id)`

---

### `player_cooldowns`
**Rôle**: Gestion des cooldowns (missions, pièges temporels)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `player_id` | INTEGER | FK → players | Joueur |
| `cooldown_type` | TEXT | NOT NULL | mission/trap |
| `related_id` | INTEGER | | ID mission/trap |
| `expires_at` | TIMESTAMP | NOT NULL | Expiration |
| `created_at` | TIMESTAMP | DEFAULT now() | Création |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `player_id` → `players(id)`

**Contrainte CHECK**: `cooldown_type IN ('mission', 'trap')`

---

### `player_malus_points`
**Rôle**: Détail des malus accumulés par joueur

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `player_id` | INTEGER | FK → players | Joueur |
| `theme_id` | INTEGER | FK → themes | Thème |
| `points` | INTEGER | NOT NULL | Points malus |
| `reason` | TEXT | | Raison (piège, etc.) |
| `created_at` | TIMESTAMP | DEFAULT now() | Attribution |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `player_id` → `players(id)`
- `theme_id` → `themes(id)`

---

### `player_active_bonuses`
**Rôle**: Super bonuses actifs des joueurs (v1.4.0+)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `user_id` | TEXT | NOT NULL | Discord User ID |
| `bonus_id` | TEXT | NOT NULL | ID bonus (legendary_magnet, etc.) |
| `name` | TEXT | NOT NULL | Nom du bonus |
| `icon` | TEXT | | Emoji |
| `duration_type` | TEXT | NOT NULL | temporary/charges/permanent |
| `duration_value` | INTEGER | | Secondes ou charges |
| `remaining_charges` | INTEGER | | Charges restantes |
| `effect_type` | TEXT | NOT NULL | rarity_boost/multiplier/reveal/etc. |
| `effect_config` | JSONB | | Config effet (target_rarity, boost_percentage, etc.) |
| `activation_mode` | TEXT | NOT NULL | automatic/manual |
| `is_active` | BOOLEAN | DEFAULT false | Actif? |
| `received_at` | TIMESTAMP | DEFAULT now() | Reçu le |
| `activated_at` | TIMESTAMP | | Activé le |
| `expires_at` | TIMESTAMP | | Expire le |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

**Contrainte CHECK**: `duration_type IN ('temporary', 'charges', 'permanent')`
**Contrainte CHECK**: `effect_type IN ('rarity_boost', 'multiplier', 'reveal', 'trap_immunity', 'trap_detection', 'insurance', 'cooldown_reduction', 'mission_reset', 'gift_collectible', 'celebrity_aura')`
**Contrainte CHECK**: `activation_mode IN ('automatic', 'manual')`

---

## 💎 TABLES SUPER BONUS SYSTEM (v1.4.0+)

### `super_bonuses`
**Rôle**: Définition des super bonuses disponibles par serveur

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `bonus_id` | TEXT | NOT NULL | Identifiant unique (legendary_magnet) |
| `name` | TEXT | NOT NULL | Nom du bonus |
| `description` | TEXT | | Description |
| `icon` | TEXT | | Emoji |
| `rarity` | TEXT | NOT NULL | legendary/epic/rare/common |
| `effect_type` | TEXT | NOT NULL | Type d'effet |
| `effect_config` | JSONB | | Configuration effet |
| `duration_type` | TEXT | NOT NULL | temporary/charges/permanent |
| `duration_value` | INTEGER | | Valeur (secondes ou charges) |
| `activation_mode` | TEXT | NOT NULL | automatic/manual |
| `is_enabled` | BOOLEAN | DEFAULT true | Bonus actif? |
| `created_at` | TIMESTAMP | DEFAULT now() | Création |
| `updated_at` | TIMESTAMP | DEFAULT now() | MAJ |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

**Contraintes CHECK**: Identiques à `player_active_bonuses`

**Contrainte UNIQUE**: `(guild_id, bonus_id)` - Un bonus_id unique par serveur

---

### `bonus_usage_history`
**Rôle**: Logs d'utilisation des super bonuses (audit)

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `user_id` | TEXT | NOT NULL | Discord User ID |
| `bonus_id` | INTEGER | FK → super_bonuses | Bonus utilisé |
| `used_at` | TIMESTAMP | DEFAULT now() | Date utilisation |
| `effect_result` | JSONB | | Résultat de l'effet |
| `trigger_type` | TEXT | | mystery_box/manual/etc. |
| `related_event_id` | INTEGER | | ID événement associé |

**Clés Étrangères**:
- `guild_id` → `guild_config(guild_id)`
- `bonus_id` → `super_bonuses(id)`

---

## 📢 TABLES SYSTÈME D'ANNONCES

### `announcement_channel`
**Rôle**: Canal Discord dédié aux annonces automatiques

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `channel_id` | TEXT | NOT NULL | Discord Channel ID |
| `channel_name` | TEXT | NOT NULL | Nom du canal |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

---

### `announcement_settings`
**Rôle**: Toggles d'activation par type d'annonce

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `legendary_collectible` | BOOLEAN | DEFAULT true | Annonce collectible légendaire |
| `collection_completed` | BOOLEAN | DEFAULT true | Collection complète |
| `collection_traded` | BOOLEAN | DEFAULT true | Échange entre joueurs |
| `collection_lost` | BOOLEAN | DEFAULT true | Perte de collectible |
| `trap_curse` | BOOLEAN | DEFAULT true | Piège malédiction |
| `trap_cooldown` | BOOLEAN | DEFAULT true | Piège cooldown |
| `trap_lose_collectible` | BOOLEAN | DEFAULT true | Piège perte collectible |
| `trap_public_shame` | BOOLEAN | DEFAULT true | Piège honte publique |
| `trap_malus_points` | BOOLEAN | DEFAULT true | Piège malus |
| `trap_empty_box` | BOOLEAN | DEFAULT true | Piège boîte vide |
| `trap_lose_all_collectibles` | BOOLEAN | DEFAULT false | Piège perte totale |
| `mission_word_guessed` | BOOLEAN | DEFAULT true | Mot-clé trouvé |
| `mission_started` | BOOLEAN | DEFAULT false | Mission démarrée |
| `mission_completed` | BOOLEAN | DEFAULT false | Mission complétée |
| `mission_failed` | BOOLEAN | DEFAULT false | Mission échouée |
| `mission_approved` | BOOLEAN | DEFAULT false | Mission approuvée |
| `mission_rejected` | BOOLEAN | DEFAULT false | Mission rejetée |
| `theme_expired` | BOOLEAN | DEFAULT false | Thème expiré |
| `theme_expiring_soon` | BOOLEAN | DEFAULT false | Thème expire bientôt |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

---

### `announcement_templates`
**Rôle**: Templates personnalisables d'annonces par type

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `type` | TEXT | NOT NULL | Type d'annonce |
| `title` | TEXT | NOT NULL | Titre embed |
| `description` | TEXT | NOT NULL | Description (supporte variables) |
| `color` | TEXT | DEFAULT '#3498db' | Couleur embed hex |
| `image_url` | TEXT | | URL image |
| `thumbnail_url` | TEXT | | URL thumbnail |
| `footer_text` | TEXT | DEFAULT 'Système d''annonces' | Footer |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

**Variables supportées**: `{username}`, `{collectible_name}`, `{collectible_emoji}`, `{trap_name}`, etc.

---

## 👑 TABLES SUPER ADMIN

### `super_admins`
**Rôle**: Super admins avec accès multi-serveur

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `discord_id` | TEXT | NOT NULL, UNIQUE | Discord User ID |
| `username` | TEXT | NOT NULL | Nom d'utilisateur |
| `created_at` | TIMESTAMP | DEFAULT now() | Ajouté le |

**Contrainte UNIQUE**: `discord_id`
**Note**: Pas de `guild_id`, accès global

---

### `super_admin_logs`
**Rôle**: Audit logs des actions super admin

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `super_admin_id` | INTEGER | FK → super_admins | Super admin |
| `action` | TEXT | NOT NULL | Action effectuée |
| `target_guild_id` | TEXT | | Serveur cible |
| `details` | JSONB | | Détails action |
| `created_at` | TIMESTAMP | DEFAULT now() | Date |

**Clés Étrangères**: `super_admin_id` → `super_admins(id)`

---

## 📝 TABLE AUDIT & LOGS

### `audit_logs`
**Rôle**: Logs des actions admin par serveur

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `guild_id` | TEXT | FK → guild_config | Guild associé |
| `action` | TEXT | NOT NULL | Action |
| `admin_id` | TEXT | NOT NULL | Discord Admin ID |
| `details` | JSONB | | Détails |
| `created_at` | TIMESTAMP | DEFAULT now() | Date |

**Clés Étrangères**: `guild_id` → `guild_config(guild_id)`

---

## 🎮 TABLE MINI-JEUX

### `apple_game_winners`
**Rôle**: Historique des gagnants du jeu de la pomme

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | ID unique |
| `user_id` | VARCHAR(20) | NOT NULL | Discord User ID |
| `guild_id` | VARCHAR(20) | NOT NULL | Guild ID |
| `won_at` | TIMESTAMP | DEFAULT now() | Date victoire |

**Note**: Pas de FK (table legacy, à migrer)

---

## 🔑 INDEX RECOMMANDÉS

```sql
-- Performance multi-serveur
CREATE INDEX idx_collections_guild_player ON collections(guild_id, player_id);
CREATE INDEX idx_player_progress_guild_theme ON player_progress(guild_id, theme_id);
CREATE INDEX idx_player_active_bonuses_guild_user ON player_active_bonuses(guild_id, user_id);
CREATE INDEX idx_missions_guild_theme ON missions(guild_id, theme_id);

-- Recherche rapide
CREATE INDEX idx_players_discord_guild ON players(discord_id, guild_id);
CREATE INDEX idx_give_logs_channel ON give_logs(guild_id, channel_id);
CREATE INDEX idx_bonus_usage_guild_user ON bonus_usage_history(guild_id, user_id);
```

---

## 🚨 RÈGLES CRITIQUES

### 1. Isolation Multi-Serveur OBLIGATOIRE

**✅ CORRECT**:
```sql
SELECT * FROM collectibles
WHERE guild_id = $1 AND theme_id = $2;
```

**❌ INCORRECT**:
```sql
SELECT * FROM collectibles
WHERE theme_id = $1; -- MANQUE guild_id
```

### 2. Contraintes UNIQUE Multi-Colonnes

Plusieurs tables utilisent `(guild_id, autre_colonne)` pour unicité par serveur:
- `players`: `(discord_id, guild_id)`
- `collections`: `(guild_id, player_id, collectible_id)`
- `super_bonuses`: `(guild_id, bonus_id)`

### 3. JSONB pour Configuration Flexible

Les colonnes `effect_config`, `details`, `effect_result` utilisent JSONB pour:
- Flexibilité des structures
- Requêtes sur sous-propriétés
- Évolution sans migration

**Exemple `effect_config` pour Aimant à Légendaires**:
```json
{
  "target_rarity": "legendary",
  "boost_percentage": 50,
  "applies_to": "collectible"
}
```

### 4. Timestamps Universels

Toutes les tables ont:
- `created_at TIMESTAMP DEFAULT now()`
- `updated_at TIMESTAMP DEFAULT now()` (si mutable)

### 5. Gestion des Clés Étrangères

**ON DELETE CASCADE**: Rarement utilisé (risque suppression cascade)
**ON DELETE RESTRICT**: Par défaut (erreur si enfants existent)
**Suppression manuelle**: Préférée avec vérifications métier

---

## 📖 Ressources

- **Script d'analyse**: [analyze-db-complete.js](analyze-db-complete.js)
- **Export JSON**: [database-schema.json](database-schema.json)
- **Wrapper DB**: [utils/database-pg.js](utils/database-pg.js)
- **Migrations**: [database/migrations/](database/migrations/)

---

**Dernière mise à jour**: 2025-11-18
**Analysé par**: Claude (Sonnet 4.5)
**Version Bot**: v1.4.1
