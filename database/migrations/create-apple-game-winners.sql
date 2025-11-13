-- Table pour tracker les gagnants du mini-jeu de la pomme
CREATE TABLE IF NOT EXISTS apple_game_winners (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  won_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_apple_game_winners_user ON apple_game_winners(user_id);
CREATE INDEX IF NOT EXISTS idx_apple_game_winners_guild ON apple_game_winners(guild_id);

COMMENT ON TABLE apple_game_winners IS 'Joueurs ayant trouvé la pomme enchantée';
