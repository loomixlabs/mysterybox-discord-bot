-- Migration: Création de la table quiz_questions
-- Date: 2025-11-09
-- Description: Table pour stocker les questions de quiz pour les missions

CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  wrong_answers TEXT[],  -- Array de mauvaises réponses (pour un futur QCM)
  hint TEXT,             -- Indice optionnel
  difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_quiz_questions_guild_theme ON quiz_questions(guild_id, theme_id);

-- Commentaires pour documentation
COMMENT ON TABLE quiz_questions IS 'Questions de quiz pour les missions thématiques';
COMMENT ON COLUMN quiz_questions.question_text IS 'Texte de la question';
COMMENT ON COLUMN quiz_questions.correct_answer IS 'Réponse correcte (pas sensible à la casse)';
COMMENT ON COLUMN quiz_questions.wrong_answers IS 'Array de mauvaises réponses pour un futur système QCM';
COMMENT ON COLUMN quiz_questions.hint IS 'Indice optionnel pour aider le joueur';
COMMENT ON COLUMN quiz_questions.difficulty IS 'Difficulté: easy, medium, hard';
