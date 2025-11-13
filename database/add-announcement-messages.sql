-- Ajouter les champs pour les messages d'annonce personnalisés

-- Missions : message quand une mission est complétée
ALTER TABLE missions ADD COLUMN announcement_message TEXT;

-- Traps : message quand un piège est activé (en plus du shame_message existant)
ALTER TABLE traps ADD COLUMN announcement_message TEXT;

-- Campaigns : message quand une campagne démarre
ALTER TABLE campaigns ADD COLUMN announcement_message TEXT;
