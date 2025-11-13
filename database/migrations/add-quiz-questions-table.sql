-- Migration: Add quiz_questions table for Quiz missions
-- Each theme can have multiple quiz questions that are randomly selected

CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guild_config(guild_id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  wrong_answers TEXT[], -- Array of wrong answer options for multiple choice
  hint TEXT, -- Optional hint for the question
  difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries by theme
CREATE INDEX IF NOT EXISTS idx_quiz_questions_theme ON quiz_questions(guild_id, theme_id);

-- Add comment for documentation
COMMENT ON TABLE quiz_questions IS 'Stores quiz questions for each theme. Questions are randomly selected when a player starts a quiz mission.';
COMMENT ON COLUMN quiz_questions.wrong_answers IS 'Array of incorrect answer options to create multiple choice format';
COMMENT ON COLUMN quiz_questions.hint IS 'Optional hint that can be revealed to help players';
