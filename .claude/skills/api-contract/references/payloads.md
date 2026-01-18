# Payloads JSON - Référence

## Theme Payload

Structure complète d'un thème (validé par `theme.schema.json`):

```json
{
  "version": "2.1",
  "theme": {
    "theme_id": "harry_potter_2024",
    "name": "Harry Potter",
    "description": "Thème Harry Potter",
    "emoji": "⚡",
    "duration_hours": 72,
    "start_date": "2024-12-01",
    "created_at": "2024-11-01T00:00:00Z"
  },
  "collectibles": [
    {
      "name": "Baguette Magique",
      "emoji": "🪄",
      "rarity": "legendary",
      "image_url": "https://...",
      "description": "La baguette de sureau"
    }
  ],
  "traps": [
    {
      "name": "Doloris",
      "emoji": "💀",
      "effect": "lose_item",
      "duration_minutes": 30,
      "probability": 15
    }
  ],
  "missions": [...],
  "messages": {...},
  "config": {...}
}
```

## Collectible Payload

```json
{
  "name": "Nom de l'item",
  "emoji": "🎁",
  "rarity": "common|rare|epic|legendary",
  "image_url": "https://...",
  "description": "Description optionnelle",
  "theme_id": 123
}
```

**Raretés valides**: `common`, `rare`, `epic`, `legendary`

## Trap Payload

```json
{
  "name": "Nom du piège",
  "emoji": "💥",
  "effect": "lose_item|lose_points|block|malus",
  "duration_minutes": 30,
  "probability": 15,
  "cooldown_minutes": 60,
  "theme_id": 123
}
```

**Effets valides**:
- `lose_item` - Perd un item aléatoire
- `lose_points` - Perd des points
- `block` - Bloqué temporairement
- `malus` - Malus de points

## Mission Payload

```json
{
  "name": "Nom de la mission",
  "description": "Description",
  "type": "quiz|keyword|channel|secret",
  "reward_type": "collectible|points|mystery_box",
  "reward_value": 1,
  "validation_data": {
    "question": "Question?",
    "answer": "Réponse",
    "options": ["A", "B", "C", "D"]
  },
  "theme_id": 123
}
```

**Types de mission**:
- `quiz` - Question à choix multiples
- `keyword` - Mot-clé à trouver
- `channel` - Action dans un canal spécifique
- `secret` - Mission secrète

## Guild Config Payload

```json
{
  "prefix": "!",
  "language": "fr",
  "timezone": "Europe/Paris",
  "admin_role_ids": ["123", "456"],
  "announcement_channel_id": "789",
  "give_channels": ["111", "222"],
  "premium": true
}
```

## Guild Branding Payload

```json
{
  "guild_name": "Mon Serveur",
  "banner_url": "https://...",
  "logo_url": "https://...",
  "primary_color": "#5865F2",
  "secondary_color": "#99AAB5",
  "footer_text": "Mon Bot Custom"
}
```

## Réponses API Standard

### Succès

```json
{
  "success": true,
  "data": { ... },
  "message": "Opération réussie"
}
```

### Erreur

```json
{
  "success": false,
  "error": "Description de l'erreur",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Liste paginée

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```
