-- Table pour les templates d'annonces personnalisables
CREATE TABLE IF NOT EXISTS announcement_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT UNIQUE NOT NULL, -- 'legendary_collectible', 'collection_completed', etc.
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3498db',
  image_url TEXT,
  thumbnail_url TEXT,
  footer_text TEXT DEFAULT 'Système d''annonces',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insérer les templates par défaut pour chaque type d'annonce
INSERT OR IGNORE INTO announcement_templates (type, title, description, color, footer_text) VALUES
(
  'legendary_collectible',
  '⭐ COLLECTIBLE LÉGENDAIRE TROUVÉ !',
  '**{userName}** a trouvé le collectible légendaire **{collectibleName}** !',
  '#FFD700',
  'Système d''annonces'
),
(
  'collection_completed',
  '🎉 COLLECTION COMPLÉTÉE !',
  '**{userName}** a complété sa collection **{themeName}** !

🏆 {userName} a obtenu le rôle **{roleName}** !',
  '#00FF00',
  'Système d''annonces'
),
(
  'collection_traded',
  '🔄 ÉCHANGE DE COLLECTION !',
  '**{user1Name}** et **{user2Name}** ont échangé leurs collections
grâce à la mission **{missionName}** !',
  '#3498db',
  'Système d''annonces'
),
(
  'collection_lost',
  '💀 COLLECTION PERDUE !',
  '**{userName}** a perdu entièrement sa collection à cause du piège **{trapName}** !',
  '#FF0000',
  'Système d''annonces'
),
(
  'trap_curse',
  '😈 MALÉDICTION ACTIVÉE !',
  '**{userName}** a reçu la malédiction du piège **{trapName}** !

{trapEffect}',
  '#8B00FF',
  'Système d''annonces'
),
(
  'mission_word_guessed',
  '🎯 MOT DEVINÉ !',
  '**{userName}** a réussi à faire deviner le mot **{word}**
dans sa mission **{missionName}** !',
  '#FFA500',
  'Système d''annonces'
);
