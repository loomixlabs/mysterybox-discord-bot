# 📊 SCHÉMA COMPLET DE LA BASE DE DONNÉES
## Bot Discord Loomix - Documentation Technique

> **Généré le**: 2025-11-29
> **Base de données**: PostgreSQL
> **Nombre de tables**: 45

---

## 📑 TABLE DES MATIÈRES

### Configuration Serveur
- [guild_config](#guild_config)
- [guild_branding](#guild_branding)
- [guild_admin_roles](#guild_admin_roles)
- [guild_stats](#guild_stats)
- [announcement_channel](#announcement_channel)
- [announcement_settings](#announcement_settings)

### Thèmes & Gameplay
- [themes](#themes)
- [theme_config](#theme_config)
- [theme_messages](#theme_messages)
- [collectibles](#collectibles)
- [traps](#traps)
- [colors](#colors)

### Missions
- [missions](#missions)
- [mission_progress](#mission_progress)
- [mission_keywords](#mission_keywords)
- [quiz_questions](#quiz_questions)

### Joueurs
- [players](#players)
- [player_progress](#player_progress)
- [collections](#collections)
- [player_cooldowns](#player_cooldowns)
- [player_malus_points](#player_malus_points)
- [player_login_history](#player_login_history)

### Badges
- [badges](#badges)
- [badge_progress](#badge_progress)
- [player_badges](#player_badges)

### Super Bonus
- [super_bonuses](#super_bonuses)
- [player_active_bonuses](#player_active_bonuses)
- [bonus_usage_history](#bonus_usage_history)

### Campagnes & Gives
- [give_campaigns](#give_campaigns)
- [give_channels](#give_channels)
- [give_logs](#give_logs)

### Annonces
- [announcement_templates](#announcement_templates)

### Pièges
- [trap_triggered](#trap_triggered)

### Super Admin
- [super_admins](#super_admins)
- [super_admin_logs](#super_admin_logs)
- [audit_logs](#audit_logs)

### Theme Builder (Dashboard)
- [themes_library](#themes_library)
- [theme_uploads](#theme_uploads)
- [theme_builder_sessions](#theme_builder_sessions)
- [theme_builder_logs](#theme_builder_logs)
- [theme_builder_config](#theme_builder_config)
- [theme_builder_user_quotas](#theme_builder_user_quotas)
- [theme_creator_guilds](#theme_creator_guilds)
- [banned_builder_users](#banned_builder_users)

### Autres
- [apple_game_winners](#apple_game_winners)

---

## 📁 CONFIGURATION SERVEUR

### guild_config

> **Lignes**: 4 | **Colonnes**: 21

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| guild_id | text | ✗ | - | 🔑 PK  |
| guild_name | text | ✗ | - |  |
| is_active | boolean | ✓ | true |  |
| is_trial | boolean | ✓ | false |  |
| trial_expires_at | timestamp without time zone | ✓ | - |  |
| co_founder_role_id | text | ✓ | - |  |
| max_players | integer | ✓ | - |  |
| owner_id | text | ✓ | - |  |
| added_at | timestamp without time zone | ✓ | now() |  |
| activated_at | timestamp without time zone | ✓ | now() |  |
| deactivated_at | timestamp without time zone | ✓ | - |  |
| last_activity | timestamp without time zone | ✓ | now() |  |
| notes | text | ✓ | - |  |
| notify_super_admins_mention | boolean | ✓ | false |  |
| notify_owner_mention | boolean | ✓ | false |  |
| notify_cofounders_mention | boolean | ✓ | true |  |
| notify_super_admins_thread | boolean | ✓ | true |  |
| notify_owner_thread | boolean | ✓ | true |  |
| notify_cofounders_thread | boolean | ✓ | true |  |
| is_premium | boolean | ✓ | false |  |
| premium_expires_at | timestamp without time zone | ✓ | - |  |

**Index:**
- `idx_guild_config_active`
- `idx_guild_config_trial`
- `idx_guild_config_guild_id`

---

### guild_branding

> **Lignes**: 4 | **Colonnes**: 14

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('guild_branding_id_seq... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| bot_display_name | text | ✓ | 'MysteryBox by Loomix'::text |  |
| primary_color | text | ✓ | '#3498db'::text |  |
| secondary_color | text | ✓ | '#2ecc71'::text |  |
| embed_footer_text | text | ✓ | 'MysteryBox by Loomix'::text |  |
| embed_footer_icon_url | text | ✓ | - |  |
| language | text | ✓ | 'fr'::text |  |
| timezone | text | ✓ | 'Europe/Paris'::text |  |
| modules_enabled | jsonb | ✓ | '["mysterybox"]'::jsonb |  |
| created_at | timestamp without time zone | ✓ | CURRENT_TIMESTAMP |  |
| updated_at | timestamp without time zone | ✓ | CURRENT_TIMESTAMP |  |
| bot_status | jsonb | ✓ | '{"text": "MysteryBox", "type"... |  |
| bot_role_id | text | ✓ | - |  |

**Index:**
- `guild_branding_guild_id_key`
- `idx_guild_branding_guild_id`

---

### guild_admin_roles

> **Lignes**: 5 | **Colonnes**: 5

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('guild_admin_roles_id_... | 🔑 PK  |
| guild_id | character varying(20) | ✗ | - |  |
| role_id | character varying(20) | ✗ | - |  |
| added_by | character varying(20) | ✗ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `guild_admin_roles_guild_id_role_id_key`
- `idx_guild_admin_roles_guild`
- `idx_guild_admin_roles_role`

---

### guild_stats

> **Lignes**: 3 | **Colonnes**: 7

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| guild_id | text | ✗ | - | 🔑 PK 🔗 FK → guild_config.guild_id |
| total_players | integer | ✓ | 0 |  |
| total_gives | integer | ✓ | 0 |  |
| total_campaigns | integer | ✓ | 0 |  |
| total_collections | integer | ✓ | 0 |  |
| last_give_at | timestamp without time zone | ✓ | - |  |
| updated_at | timestamp without time zone | ✓ | now() |  |

---

### announcement_channel

> **Lignes**: 4 | **Colonnes**: 6

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('announcement_channel_... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| channel_id | text | ✗ | - |  |
| channel_name | text | ✗ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `announcement_channel_guild_id_key`

---

### announcement_settings

> **Lignes**: 4 | **Colonnes**: 24

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('announcement_settings... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| legendary_collectible | boolean | ✓ | true |  |
| collection_completed | boolean | ✓ | true |  |
| collection_traded | boolean | ✓ | true |  |
| collection_lost | boolean | ✓ | true |  |
| mission_word_guessed | boolean | ✓ | true |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |
| theme_expired | boolean | ✓ | false |  |
| theme_expiring_soon | boolean | ✓ | false |  |
| mission_started | boolean | ✓ | false |  |
| mission_completed | boolean | ✓ | false |  |
| mission_failed | boolean | ✓ | false |  |
| mission_approved | boolean | ✓ | false |  |
| mission_rejected | boolean | ✓ | false |  |
| trap_cooldown | boolean | ✓ | true |  |
| trap_lose_collectible | boolean | ✓ | true |  |
| trap_public_shame | boolean | ✓ | true |  |
| trap_empty_box | boolean | ✓ | true |  |
| trap_lose_all_collectibles | boolean | ✓ | false |  |
| legendary_super_bonus | boolean | ✓ | true |  |
| trap_curse | boolean | ✓ | true |  |
| trap_malus_points | boolean | ✓ | true |  |

**Index:**
- `announcement_settings_guild_id_key`

---

## 📁 THÈMES & GAMEPLAY

### themes

> **Lignes**: 9 | **Colonnes**: 13

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('themes_id_seq'::regcl... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| theme_id | text | ✗ | - |  |
| name | text | ✗ | - |  |
| is_active | boolean | ✓ | false |  |
| duration_days | integer | ✗ | - |  |
| required_items | integer | ✗ | - |  |
| final_role_name | text | ✗ | - |  |
| final_role_color | text | ✗ | - |  |
| final_role_discord_id | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |
| activated_at | timestamp without time zone | ✓ | - |  |

**Index:**
- `themes_guild_id_theme_id_key`
- `idx_themes_guild`
- `idx_themes_active`

---

### theme_config

> **Lignes**: 8 | **Colonnes**: 23

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('theme_config_id_seq':... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| probability_collectible | integer | ✓ | 50 |  |
| probability_mission | integer | ✓ | 35 |  |
| probability_trap | integer | ✓ | 15 |  |
| mystery_box_image | text | ✓ | - |  |
| mystery_box_title | text | ✓ | '🎁 BOÎTE MYSTÉRIEUSE'::text |  |
| mystery_box_description | text | ✓ | 'Que contient-elle ?'::text |  |
| mystery_box_winner_message | text | ✓ | '🎉 **{player}** a ouvert la b... |  |
| mystery_box_celebration_gif | text | ✓ | 'https://media.giphy.com/media... |  |
| mystery_box_celebration_emojis | text | ✓ | '🎉,🎊,✨,🌟'::text |  |
| probability_super_bonus | integer | ✓ | 10 |  |
| collectible_rarity_legendary | integer | ✓ | 5 |  |
| collectible_rarity_epic | integer | ✓ | 10 |  |
| collectible_rarity_rare | integer | ✓ | 20 |  |
| collectible_rarity_common | integer | ✓ | 40 |  |
| super_bonus_rarity_legendary | integer | ✓ | 5 |  |
| super_bonus_rarity_epic | integer | ✓ | 10 |  |
| super_bonus_rarity_rare | integer | ✓ | 20 |  |
| super_bonus_rarity_common | integer | ✓ | 40 |  |
| auto_delete_celebration_message | boolean | ✓ | false |  |
| progression_roles | jsonb | ✓ | '[]'::jsonb |  |

**Contraintes CHECK:**
- `check_probabilities_sum_100`: CHECK (((((probability_collectible + probability_mission) + probability_trap) + COALESCE(probability_super_bonus, 0)) = 100))

**Index:**
- `theme_config_guild_id_theme_id_key`
- `idx_theme_config_guild`
- `idx_theme_config_progression_roles`

---

### theme_messages

> **Lignes**: 61 | **Colonnes**: 5

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('theme_messages_id_seq... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| key | text | ✗ | - |  |
| content | text | ✗ | - |  |

**Index:**
- `theme_messages_guild_id_theme_id_key_key`

---

### collectibles

> **Lignes**: 174 | **Colonnes**: 9

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('collectibles_id_seq':... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| collectible_id | text | ✗ | - |  |
| name | text | ✗ | - |  |
| image_url | text | ✗ | - |  |
| rarity | text | ✓ | 'common'::text |  |
| reveal_message | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |

**Contraintes CHECK:**
- `collectibles_rarity_check`: CHECK ((rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text])))

**Index:**
- `collectibles_guild_id_theme_id_collectible_id_key`
- `idx_collectibles_guild`
- `idx_collectibles_theme`
- `idx_collectibles_rarity`

---

### traps

> **Lignes**: 39 | **Colonnes**: 20

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('traps_id_seq'::regcla... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| trap_id | text | ✗ | - |  |
| name | text | ✗ | - |  |
| type | text | ✗ | - |  |
| description | text | ✗ | - |  |
| image_url | text | ✓ | - |  |
| cooldown_duration | integer | ✓ | - |  |
| removes_collectible | boolean | ✓ | false |  |
| shame_message | text | ✓ | - |  |
| shame_channel_id | text | ✓ | - |  |
| malus_points | integer | ✓ | 0 |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| is_default | boolean | ✓ | false |  |
| is_active | boolean | ✓ | true |  |
| notif_title | text | ✓ | - |  |
| notif_description | text | ✓ | - |  |
| notif_color | text | ✓ | '#e74c3c'::text |  |
| notif_footer | text | ✓ | - |  |

**Contraintes CHECK:**
- `traps_type_check`: CHECK ((type = ANY (ARRAY['cooldown'::text, 'lose-collectible'::text, 'lose-all-collectibles'::text, 'public-shame'::text, 'points-malus'::text, 'empty-box'::text])))

**Index:**
- `idx_traps_guild`
- `idx_traps_theme`
- `idx_traps_active`
- `idx_traps_default`
- `traps_guild_id_theme_id_trap_id_key`

---

### colors

> **Lignes**: 70 | **Colonnes**: 6

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('colors_id_seq'::regcl... | 🔑 PK  |
| name | text | ✗ | - |  |
| hex_code | text | ✗ | - |  |
| emoji | text | ✓ | - |  |
| category | text | ✗ | - |  |
| created_at | timestamp without time zone | ✓ | CURRENT_TIMESTAMP |  |

**Index:**
- `colors_name_key`
- `colors_hex_code_key`

---

## 📁 MISSIONS

### missions

> **Lignes**: 31 | **Colonnes**: 16

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('missions_id_seq'::reg... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| mission_id | text | ✗ | - |  |
| name | text | ✗ | - |  |
| type | text | ✗ | - |  |
| description | text | ✗ | - |  |
| validation_type | text | ✗ | - |  |
| validation_data | jsonb | ✓ | - |  |
| timeout | integer | ✓ | 30 |  |
| image_url | text | ✓ | - |  |
| reward_type | text | ✓ | 'random-collectible'::text |  |
| reward_data | jsonb | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| allowed_channels | ARRAY | ✓ | - |  |
| max_attempts | integer | ✓ | - |  |

**Contraintes CHECK:**
- `missions_type_check`: CHECK ((type = ANY (ARRAY['keyword-message'::text, 'reaction-message'::text, 'quiz'::text, 'voice-join'::text, 'message-count'::text, 'reaction-count'::text, 'manual'::text])))
- `missions_validation_type_check`: CHECK ((validation_type = ANY (ARRAY['auto'::text, 'manual'::text])))
- `missions_reward_type_check`: CHECK ((reward_type = ANY (ARRAY['random-collectible'::text, 'specific-collectible'::text, 'bonus-points'::text])))

**Index:**
- `idx_missions_guild`
- `idx_missions_theme`
- `idx_missions_max_attempts`
- `missions_guild_id_theme_id_mission_id_key`

---

### mission_progress

> **Lignes**: 465 | **Colonnes**: 15

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('mission_progress_id_s... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| player_id | integer | ✗ | - | 🔗 FK → players.id |
| mission_id | integer | ✗ | - | 🔗 FK → missions.id |
| thread_id | text | ✓ | - |  |
| status | text | ✓ | 'pending'::text |  |
| submitted_proof | text | ✓ | - |  |
| validated_by | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |
| completed_at | timestamp without time zone | ✓ | - |  |
| target_channel_id | text | ✓ | - |  |
| target_keyword | text | ✓ | - |  |
| mission_type | text | ✓ | - |  |
| expires_at | timestamp without time zone | ✓ | - |  |

**Contraintes CHECK:**
- `mission_progress_status_check`: CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])))

**Index:**
- `idx_mission_progress_guild`
- `idx_mission_progress_status`
- `idx_mission_progress_active_keyword`
- `idx_mission_progress_expires`

---

### mission_keywords

> **Lignes**: 74 | **Colonnes**: 7

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('mission_keywords_id_s... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| mission_id | integer | ✗ | - | 🔗 FK → missions.id |
| keyword | text | ✗ | - |  |
| target_channel_id | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| difficulty | text | ✓ | 'medium'::text |  |

**Contraintes CHECK:**
- `mission_keywords_difficulty_check`: CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])))

**Index:**
- `mission_keywords_guild_id_mission_id_keyword_key`
- `idx_mission_keywords_lookup`
- `idx_mission_keywords_mission`

---

### quiz_questions

> **Lignes**: 138 | **Colonnes**: 11

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('quiz_questions_id_seq... | 🔑 PK  |
| guild_id | character varying(20) | ✗ | - |  |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| question_text | text | ✗ | - |  |
| correct_answer | text | ✗ | - |  |
| wrong_answers | ARRAY | ✓ | - |  |
| hint | text | ✓ | - |  |
| difficulty | character varying(20) | ✓ | 'medium'::character varying |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |
| mission_id | integer | ✓ | - | 🔗 FK → missions.id |

**Index:**
- `idx_quiz_questions_guild_theme`

---

## 📁 JOUEURS

### players

> **Lignes**: 53 | **Colonnes**: 11

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('players_id_seq'::regc... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| discord_id | text | ✗ | - |  |
| username | text | ✗ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |
| preferred_color | text | ✓ | - |  |
| traps_blocked | integer | ✓ | 0 |  |
| current_login_streak | integer | ✓ | 0 |  |
| last_login_date | date | ✓ | - |  |
| best_login_streak | integer | ✓ | 0 |  |

**Index:**
- `players_guild_id_discord_id_key`
- `idx_players_guild`
- `idx_players_discord_id`
- `idx_players_traps_blocked`
- `players_guild_id_id_key`
- `idx_players_login_streak`

---

### player_progress

> **Lignes**: 49 | **Colonnes**: 10

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('player_progress_id_se... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| player_id | integer | ✗ | - | 🔗 FK → players.id |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| collected_count | integer | ✓ | 0 |  |
| is_completed | boolean | ✓ | false |  |
| completed_at | timestamp without time zone | ✓ | - |  |
| started_at | timestamp without time zone | ✓ | now() |  |
| last_collected_at | timestamp without time zone | ✓ | - |  |
| achieved_progression_roles | ARRAY | ✓ | '{}'::integer[] |  |

**Index:**
- `player_progress_guild_id_player_id_theme_id_key`
- `idx_progress_guild`
- `idx_progress_player_theme`

---

### collections

> **Lignes**: 218 | **Colonnes**: 7

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('collections_id_seq'::... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| player_id | integer | ✗ | - | 🔗 FK → players.id |
| collectible_id | integer | ✗ | - | 🔗 FK → collectibles.id |
| collected_at | timestamp without time zone | ✓ | now() |  |
| source | text | ✓ | 'give'::text |  |
| lost_at | timestamp without time zone | ✓ | - |  |

**Contraintes CHECK:**
- `collections_source_check`: CHECK ((source = ANY (ARRAY['give'::text, 'mission'::text, 'mystery_box'::text])))

**Index:**
- `collections_guild_id_player_id_collectible_id_key`
- `idx_collections_guild`
- `idx_collections_player`
- `idx_collections_lost_at`

---

### player_cooldowns

> **Lignes**: 55 | **Colonnes**: 7

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('player_cooldowns_id_s... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| player_id | integer | ✗ | - | 🔗 FK → players.id |
| trap_id | integer | ✗ | - | 🔗 FK → traps.id |
| started_at | timestamp without time zone | ✓ | now() |  |
| expires_at | timestamp without time zone | ✗ | - |  |
| is_active | boolean | ✓ | true |  |

**Index:**
- `idx_cooldowns_guild`
- `idx_cooldowns_active`

---

### player_malus_points

> **Lignes**: 1 | **Colonnes**: 6

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('player_malus_points_i... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| player_id | integer | ✗ | - | 🔗 FK → players.id |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| points | integer | ✓ | 0 |  |
| updated_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `player_malus_points_guild_id_player_id_theme_id_key`

---

### player_login_history

> **Lignes**: 91 | **Colonnes**: 5

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('player_login_history_... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → players.guild_id |
| player_id | integer | ✗ | - | 🔗 FK → players.guild_id |
| login_date | date | ✗ | CURRENT_DATE |  |
| created_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `player_login_history_guild_id_player_id_login_date_key`
- `idx_login_history_guild_player`
- `idx_login_history_date`
- `idx_login_history_lookup`

---

## 📁 BADGES

### badges

> **Lignes**: 37 | **Colonnes**: 14

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('badges_id_seq'::regcl... | 🔑 PK  |
| code | text | ✗ | - |  |
| name | text | ✗ | - |  |
| description | text | ✗ | - |  |
| emoji | text | ✗ | - |  |
| color | text | ✗ | - |  |
| rarity | text | ✗ | - |  |
| category | text | ✗ | - |  |
| condition_type | text | ✗ | - |  |
| condition_target | text | ✓ | - |  |
| condition_value | integer | ✓ | - |  |
| display_order | integer | ✓ | 0 |  |
| is_secret | boolean | ✓ | false |  |
| created_at | timestamp without time zone | ✓ | now() |  |

**Contraintes CHECK:**
- `badges_category_check`: CHECK ((category = ANY (ARRAY['super_bonus'::text, 'collection'::text, 'rarity'::text, 'mystery_box'::text, 'trap'::text, 'mission'::text, 'engagement'::text, 'social'::text, 'special'::text])))
- `badges_condition_type_check`: CHECK ((condition_type = ANY (ARRAY['super_bonus_usage'::text, 'super_bonus_unlock'::text, 'collectible_count'::text, 'rarity_collect'::text, 'mystery_box_open'::text, 'trap_survive'::text, 'trap_block'::text, 'mission_complete'::text, 'login_streak'::text, 'custom'::text])))
- `badges_rarity_check`: CHECK ((rarity = ANY (ARRAY['common'::text, 'uncommon'::text, 'rare'::text, 'epic'::text, 'legendary'::text, 'mythic'::text])))

**Index:**
- `badges_code_key`
- `idx_badges_category`
- `idx_badges_rarity`
- `idx_badges_condition`

---

### badge_progress

> **Lignes**: 559 | **Colonnes**: 9

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('badge_progress_id_seq... | 🔑 PK  |
| guild_id | text | ✗ | - |  |
| player_id | integer | ✗ | - | 🔗 FK → players.id |
| badge_id | integer | ✗ | - | 🔗 FK → badges.id |
| current_value | integer | ✓ | 0 |  |
| target_value | integer | ✗ | - |  |
| percentage | numeric | ✓ | - |  |
| started_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `badge_progress_guild_id_player_id_badge_id_key`
- `idx_badge_progress_player`
- `idx_badge_progress_badge`
- `idx_badge_progress_percentage`

---

### player_badges

> **Lignes**: 92 | **Colonnes**: 6

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('player_badges_id_seq'... | 🔑 PK  |
| guild_id | text | ✗ | - |  |
| player_id | integer | ✗ | - | 🔗 FK → players.id |
| badge_id | integer | ✗ | - | 🔗 FK → badges.id |
| unlocked_at | timestamp without time zone | ✓ | now() |  |
| unlocked_from | text | ✓ | - |  |

**Index:**
- `player_badges_guild_id_player_id_badge_id_key`
- `idx_player_badges_player`
- `idx_player_badges_badge`
- `idx_player_badges_unlocked`

---

## 📁 SUPER BONUS

### super_bonuses

> **Lignes**: 45 | **Colonnes**: 19

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('super_bonuses_id_seq'... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| bonus_id | text | ✗ | - |  |
| name | text | ✗ | - |  |
| description | text | ✗ | - |  |
| icon | text | ✓ | - |  |
| bonus_type | text | ✗ | - |  |
| effect_type | text | ✗ | - |  |
| effect_config | jsonb | ✓ | - |  |
| duration_type | text | ✗ | - |  |
| duration_value | integer | ✓ | - |  |
| image_url | text | ✓ | - |  |
| color | text | ✓ | '#3498db'::text |  |
| rarity | text | ✓ | 'common'::text |  |
| theme_id | integer | ✓ | - | 🔗 FK → themes.id |
| announcement_message | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| activation_mode | text | ✓ | 'manual'::text |  |
| is_enabled | boolean | ✗ | true |  |

**Contraintes CHECK:**
- `super_bonuses_duration_type_check`: CHECK ((duration_type = ANY (ARRAY['temporary'::text, 'charges'::text, 'permanent'::text])))
- `super_bonuses_rarity_check`: CHECK ((rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text])))
- `super_bonuses_check`: CHECK ((((duration_type = 'temporary'::text) AND (duration_value > 0)) OR ((duration_type = 'charges'::text) AND (duration_value > 0)) OR ((duration_type = 'permanent'::text) AND (duration_value IS NULL))))
- `super_bonuses_effect_type_check`: CHECK ((effect_type = ANY (ARRAY['probability'::text, 'cosmetic'::text, 'protection'::text, 'cooldown'::text, 'reveal'::text, 'transfer'::text, 'rarity_boost'::text, 'multiplier'::text, 'detector'::text, 'voice'::text, 'reroll'::text])))
- `super_bonuses_activation_mode_check`: CHECK ((activation_mode = ANY (ARRAY['automatic'::text, 'manual'::text])))
- `super_bonuses_bonus_type_check`: CHECK ((bonus_type = ANY (ARRAY['boost'::text, 'economy'::text, 'protection'::text, 'social'::text, 'time'::text, 'reveal'::text])))

**Index:**
- `super_bonuses_guild_id_bonus_id_key`
- `idx_super_bonuses_guild`
- `idx_super_bonuses_theme`
- `idx_super_bonuses_is_enabled`

---

### player_active_bonuses

> **Lignes**: 107 | **Colonnes**: 11

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('player_active_bonuses... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| user_id | text | ✗ | - |  |
| bonus_id | integer | ✗ | - | 🔗 FK → super_bonuses.id |
| activated_at | timestamp without time zone | ✓ | - |  |
| expires_at | timestamp without time zone | ✓ | - |  |
| remaining_charges | integer | ✓ | - |  |
| is_active | boolean | ✓ | true |  |
| used_at | timestamp without time zone | ✓ | - |  |
| obtained_from | text | ✓ | - |  |
| given_by | text | ✓ | - |  |

**Index:**
- `idx_active_bonuses_guild`
- `idx_active_bonuses_user`
- `idx_active_bonuses_expires`

---

### bonus_usage_history

> **Lignes**: 43 | **Colonnes**: 8

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('bonus_usage_history_i... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| user_id | text | ✗ | - |  |
| bonus_id | integer | ✗ | - | 🔗 FK → super_bonuses.id |
| used_at | timestamp without time zone | ✓ | now() |  |
| effect_result | jsonb | ✓ | - |  |
| trigger_type | text | ✓ | - |  |
| related_event_id | integer | ✓ | - |  |

---

## 📁 CAMPAGNES & GIVES

### give_campaigns

> **Lignes**: 137 | **Colonnes**: 21

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('give_campaigns_id_seq... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| campaign_id | text | ✗ | - |  |
| theme_id | integer | ✗ | - | 🔗 FK → themes.id |
| campaign_type | text | ✗ | - |  |
| mode | text | ✗ | - |  |
| burst_count | integer | ✓ | - |  |
| burst_interval | integer | ✓ | - |  |
| scheduled_duration | integer | ✓ | - |  |
| scheduled_interval | integer | ✓ | - |  |
| total_gives_planned | integer | ✗ | - |  |
| total_gives_posted | integer | ✓ | 0 |  |
| status | text | ✓ | 'running'::text |  |
| admin_id | text | ✗ | - |  |
| channel_id | text | ✓ | - |  |
| category_id | text | ✓ | - |  |
| started_at | timestamp without time zone | ✓ | now() |  |
| last_give_at | timestamp without time zone | ✓ | - |  |
| next_give_at | timestamp without time zone | ✓ | - |  |
| completed_at | timestamp without time zone | ✓ | - |  |
| target_channels | text | ✓ | - |  |

**Contraintes CHECK:**
- `give_campaigns_campaign_type_check`: CHECK ((campaign_type = ANY (ARRAY['burst'::text, 'scheduled'::text])))
- `give_campaigns_mode_check`: CHECK ((mode = ANY (ARRAY['random'::text, 'here'::text, 'specific'::text])))
- `give_campaigns_status_check`: CHECK ((status = ANY (ARRAY['running'::text, 'paused'::text, 'stopped'::text, 'completed'::text])))

**Index:**
- `give_campaigns_guild_id_campaign_id_key`
- `idx_campaigns_guild`
- `idx_campaigns_status`

---

### give_channels

> **Lignes**: 13 | **Colonnes**: 8

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('give_channels_id_seq'... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| type | text | ✗ | - |  |
| discord_id | text | ✗ | - |  |
| name | text | ✗ | - |  |
| parent_category_id | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| created_by | text | ✗ | - |  |

**Contraintes CHECK:**
- `give_channels_type_check`: CHECK ((type = ANY (ARRAY['category'::text, 'channel'::text])))

**Index:**
- `give_channels_guild_id_discord_id_key`
- `idx_give_channels_guild`
- `idx_give_channels_type`

---

### give_logs

> **Lignes**: 1863 | **Colonnes**: 11

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('give_logs_id_seq'::re... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| give_type | text | ✗ | - |  |
| item_id | integer | ✗ | - |  |
| message_id | text | ✗ | - |  |
| channel_id | text | ✗ | - |  |
| winner_id | text | ✓ | - |  |
| winner_username | text | ✓ | - |  |
| campaign_id | integer | ✓ | - | 🔗 FK → give_campaigns.id |
| created_at | timestamp without time zone | ✓ | now() |  |
| claimed_at | timestamp without time zone | ✓ | - |  |

**Contraintes CHECK:**
- `give_logs_give_type_check`: CHECK ((give_type = ANY (ARRAY['collectible'::text, 'mission'::text, 'trap'::text, 'super_bonus'::text])))

**Index:**
- `idx_give_logs_guild`
- `idx_give_logs_message`

---

## 📁 ANNONCES

### announcement_templates

> **Lignes**: 153 | **Colonnes**: 12

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('announcement_template... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| type | text | ✗ | - |  |
| title | text | ✗ | - |  |
| description | text | ✗ | - |  |
| color | text | ✓ | '#3498db'::text |  |
| image_url | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |
| footer_text | text | ✓ | 'Système d''annonces'::text |  |
| thumbnail_url | text | ✓ | - |  |
| theme_id | integer | ✓ | - | 🔗 FK → themes.id |

**Index:**
- `idx_announcement_templates_theme_id`
- `idx_announcement_templates_guild_type_theme`
- `announcement_templates_guild_type_theme_unique`

---

## 📁 PIÈGES

### trap_triggered

> **Lignes**: 661 | **Colonnes**: 5

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('trap_triggered_id_seq... | 🔑 PK  |
| guild_id | text | ✗ | - | 🔗 FK → guild_config.guild_id |
| player_id | integer | ✗ | - | 🔗 FK → players.id |
| trap_id | integer | ✗ | - | 🔗 FK → traps.id |
| triggered_at | timestamp without time zone | ✓ | now() |  |

---

## 📁 SUPER ADMIN

### super_admins

> **Lignes**: 2 | **Colonnes**: 6

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('super_admins_id_seq':... | 🔑 PK  |
| discord_id | text | ✗ | - |  |
| username | text | ✗ | - |  |
| role | text | ✓ | 'admin'::text |  |
| added_at | timestamp without time zone | ✓ | now() |  |
| added_by | text | ✓ | - |  |

**Contraintes CHECK:**
- `super_admins_role_check`: CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text])))

**Index:**
- `super_admins_discord_id_key`

---

### super_admin_logs

> **Lignes**: 1 | **Colonnes**: 7

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('super_admin_logs_id_s... | 🔑 PK  |
| admin_id | text | ✗ | - |  |
| action | text | ✗ | - |  |
| target_guild_id | text | ✓ | - |  |
| details | jsonb | ✓ | - |  |
| ip_address | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `idx_super_admin_logs_admin`
- `idx_super_admin_logs_created`

---

### audit_logs

> **Lignes**: 735 | **Colonnes**: 6

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('audit_logs_id_seq'::r... | 🔑 PK  |
| guild_id | text | ✓ | - | 🔗 FK → guild_config.guild_id |
| action | text | ✗ | - |  |
| admin_id | text | ✗ | - |  |
| details | jsonb | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `idx_audit_logs_guild`
- `idx_audit_logs_admin`

---

## 📁 THEME BUILDER (DASHBOARD)

### themes_library

> **Lignes**: 1 | **Colonnes**: 16

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('themes_library_id_seq... | 🔑 PK  |
| theme_id | character varying(100) | ✗ | - |  |
| theme_data | jsonb | ✗ | - |  |
| name | character varying(255) | ✗ | - |  |
| description | text | ✓ | - |  |
| version | integer | ✓ | 1 |  |
| creator_discord_id | character varying(50) | ✗ | - |  |
| creator_username | character varying(100) | ✓ | - |  |
| visibility | character varying(20) | ✓ | 'private'::character varying |  |
| parent_theme_id | character varying(100) | ✓ | - | 🔗 FK → themes_library.theme_id |
| fork_count | integer | ✓ | 0 |  |
| download_count | integer | ✓ | 0 |  |
| is_featured | boolean | ✓ | false |  |
| created_at | timestamp without time zone | ✓ | now() |  |
| updated_at | timestamp without time zone | ✓ | now() |  |
| published_at | timestamp without time zone | ✓ | - |  |

**Contraintes CHECK:**
- `themes_library_visibility_check`: CHECK (((visibility)::text = ANY ((ARRAY['public'::character varying, 'private'::character varying])::text[])))

**Index:**
- `themes_library_theme_id_key`
- `themes_library_creator_idx`
- `idx_themes_library_creator`
- `idx_themes_library_visibility`
- `idx_themes_library_featured`

---

### theme_uploads

> **Lignes**: 18 | **Colonnes**: 15

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('theme_uploads_id_seq'... | 🔑 PK  |
| uploader_discord_id | character varying(50) | ✗ | - |  |
| uploader_username | character varying(100) | ✓ | - |  |
| theme_id | character varying(100) | ✓ | - | 🔗 FK → themes_library.theme_id |
| filename | character varying(255) | ✗ | - |  |
| original_filename | character varying(255) | ✓ | - |  |
| file_path | character varying(500) | ✗ | - |  |
| public_url | character varying(500) | ✓ | - |  |
| file_size | integer | ✗ | - |  |
| mime_type | character varying(50) | ✓ | - |  |
| width | integer | ✓ | - |  |
| height | integer | ✓ | - |  |
| is_used | boolean | ✓ | true |  |
| upload_date | timestamp without time zone | ✓ | now() |  |
| last_used_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `idx_theme_uploads_uploader`
- `idx_theme_uploads_theme`
- `idx_theme_uploads_orphan`
- `idx_theme_uploads_date`

---

### theme_builder_sessions

> **Lignes**: 5 | **Colonnes**: 3

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| sid | character varying | ✗ | - | 🔑 PK  |
| sess | json | ✗ | - |  |
| expire | timestamp without time zone | ✗ | - |  |

**Index:**
- `IDX_session_expire`

---

### theme_builder_logs

> **Lignes**: 60 | **Colonnes**: 10

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('theme_builder_logs_id... | 🔑 PK  |
| discord_id | character varying(50) | ✓ | - |  |
| username | character varying(100) | ✓ | - |  |
| action | character varying(50) | ✗ | - |  |
| target_type | character varying(30) | ✓ | - |  |
| target_id | character varying(100) | ✓ | - |  |
| details | jsonb | ✓ | - |  |
| ip_address | character varying(50) | ✓ | - |  |
| user_agent | text | ✓ | - |  |
| created_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `idx_builder_logs_discord`
- `idx_builder_logs_action`
- `idx_builder_logs_date`
- `idx_theme_builder_logs_action`
- `idx_theme_builder_logs_discord_id`
- `idx_theme_builder_logs_created_at`
- `idx_theme_builder_logs_target`

---

### theme_builder_config

> **Lignes**: 5 | **Colonnes**: 6

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('theme_builder_config_... | 🔑 PK  |
| config_key | character varying(100) | ✗ | - |  |
| config_value | character varying(255) | ✗ | - |  |
| description | text | ✓ | - |  |
| updated_at | timestamp without time zone | ✓ | now() |  |
| updated_by | character varying(50) | ✓ | - |  |

**Index:**
- `theme_builder_config_config_key_key`

---

### theme_builder_user_quotas

> **Lignes**: 1 | **Colonnes**: 7

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| discord_id | character varying(50) | ✓ | - |  |
| total_uploads | bigint | ✓ | - |  |
| total_size_bytes | bigint | ✓ | - |  |
| total_size_mb | numeric | ✓ | - |  |
| quota_mb | numeric | ✓ | - |  |
| remaining_mb | numeric | ✓ | - |  |
| last_upload | timestamp without time zone | ✓ | - |  |

---

### theme_creator_guilds

> **Lignes**: 0 | **Colonnes**: 5

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('theme_creator_guilds_... | 🔑 PK  |
| theme_id | character varying(100) | ✗ | - | 🔗 FK → themes_library.theme_id |
| guild_id | character varying(50) | ✗ | - |  |
| granted_at | timestamp without time zone | ✓ | now() |  |
| granted_by | character varying(50) | ✓ | - |  |

**Index:**
- `theme_creator_guilds_theme_id_guild_id_key`

---

### banned_builder_users

> **Lignes**: 0 | **Colonnes**: 7

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('banned_builder_users_... | 🔑 PK  |
| discord_id | character varying(50) | ✗ | - |  |
| username | character varying(100) | ✓ | - |  |
| reason | text | ✓ | - |  |
| banned_by | character varying(50) | ✓ | - |  |
| banned_at | timestamp without time zone | ✓ | now() |  |
| expires_at | timestamp without time zone | ✓ | - |  |

**Index:**
- `banned_builder_users_discord_id_key`

---

## 📁 AUTRES

### apple_game_winners

> **Lignes**: 0 | **Colonnes**: 4

| Colonne | Type | Nullable | Défaut | Description |
|---------|------|----------|--------|-------------|
| id | integer | ✗ | nextval('apple_game_winners_id... | 🔑 PK  |
| user_id | character varying(20) | ✗ | - |  |
| guild_id | character varying(20) | ✗ | - |  |
| won_at | timestamp without time zone | ✓ | now() |  |

**Index:**
- `apple_game_winners_user_id_guild_id_key`
- `idx_apple_game_winners_user`
- `idx_apple_game_winners_guild`

---

## 🔗 RELATIONS ENTRE TABLES

```
guild_config (1) ──────< (N) themes
themes (1) ────────────< (N) collectibles
themes (1) ────────────< (N) traps
themes (1) ────────────< (N) missions
themes (1) ────────────< (N) theme_config
themes (1) ────────────< (N) theme_messages
missions (1) ──────────< (N) quiz_questions
missions (1) ──────────< (N) mission_keywords
missions (1) ──────────< (N) mission_progress
players (1) ───────────< (N) collections
players (1) ───────────< (N) player_progress
players (1) ───────────< (N) player_active_bonuses
players (1) ───────────< (N) player_cooldowns
collectibles (1) ──────< (N) collections
super_bonuses (1) ─────< (N) player_active_bonuses
badges (1) ────────────< (N) player_badges
badges (1) ────────────< (N) badge_progress
```

## ⚠️ RÈGLES CRITIQUES

### Isolation Multi-Serveur
**TOUTES les requêtes SQL doivent inclure `guild_id`** pour assurer l'isolation des données entre serveurs.

```sql
-- ✅ CORRECT
SELECT * FROM collectibles WHERE guild_id = $1 AND theme_id = $2;

-- ❌ INCORRECT (fuite de données entre serveurs)
SELECT * FROM collectibles WHERE theme_id = $2;
```

### Colonnes Communes
La plupart des tables incluent:
- `guild_id`: VARCHAR(32) - ID du serveur Discord
- `created_at`: TIMESTAMP - Date de création
- `updated_at`: TIMESTAMP - Dernière modification

---

*Document généré automatiquement par generate-database-schema-md.js*
