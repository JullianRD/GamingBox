-- 004 : un jeu IGDB peut ne pas avoir de jaquette ni de date de sortie
SET CLIENT_ENCODING TO 'UTF8';

ALTER TABLE games ALTER COLUMN release_date DROP NOT NULL;
ALTER TABLE games ALTER COLUMN thumbnail_url DROP NOT NULL;
