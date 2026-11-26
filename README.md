# GamingBox - Ta liste de jeux vidéo améliorée

**GamingBox** permet de tenir la liste de ses jeux (terminés ou non), d'écrire des reviews et de les partager avec ses amis. L'application se veut une alternative à Letterboxd ou BacklogGD pour les joueurs.

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)

## Fonctionnalités

**Bibliothèque**

- Reviews (note, statut, plateforme, avis) avec recherche, filtres, tri et pagination
- Recherche et import de jeux depuis IGDB (avec cache et limitation de débit)
- Tags personnels, listes thématiques (« Mes 10 meilleurs RPG »)
- Import CSV d'une bibliothèque existante (200 lignes max.)
- Statistiques par année : terminés, genres, plateformes, notes, jeux terminés par mois

**Social et partage**

- Partage d'une review ou d'un profil par email : lien secret, expiration, limite de vues (décompte atomique)
- Profil public optionnel (`/u/pseudo`), reviews publiques, abonnements, fil d'actualité, likes
- Cartes de partage (Open Graph) pour les liens

**Compte et sécurité**

- Inscription avec vérification d'email, mot de passe oublié, contrôle des mots de passe compromis (HIBP, k-anonymat)
- Sessions PostgreSQL régénérées à la connexion, CSRF sur tous les formulaires (upload compris), limitation des tentatives
- Export RGPD (JSON) et suppression de compte (données et avatar effacés), journal d'activité purgé automatiquement

**Exploitation**

- `/health`, logs JSON avec identifiant de requête et masquage des secrets, arrêt propre
- PWA installable (manifest, page hors ligne), sauvegarde et restauration de la base

## Stack

Node.js 22+, Express 5, EJS + Tailwind (CDN), PostgreSQL 18 (`uuidv7()` natif), Argon2id, Zod, pino, nodemailer, sharp.

## Démarrage

```bash
npm install
cp .env.example .env        # puis renseigner les valeurs (secrets : voir le fichier)
sh scripts/init_db.sh       # crée la base, le rôle applicatif, les tables, les vues et applique les patches
npm run dev
```

Pour une base existante, applique les nouveaux patches de schéma avec :

```bash
npm run migrate
```

`npm run migrate` exécute les fichiers de `database/migrations/patches/` non encore appliqués (historique dans la table `schema_migrations`). Utilise `MIGRATE_DATABASE_URL` (compte propriétaire du schéma) si `DATABASE_URL` désigne le compte applicatif restreint.

## Scripts

| Commande                                     | Rôle                                         |
| -------------------------------------------- | -------------------------------------------- |
| `npm run dev`                                | serveur avec rechargement                    |
| `npm start`                                  | serveur de production                        |
| `npm test`                                   | tests d'intégration et unitaires             |
| `npm run lint` / `npm run format:check`      | ESLint / Prettier                            |
| `npm run migrate`                            | patches de schéma                            |
| `scripts/backup_db.sh [dossier]`             | sauvegarde `pg_dump` vérifiée + rétention    |
| `scripts/restore_db.sh <dump> <url_cible>`   | restauration (refuse la base courante)       |

## Tests

Les tests utilisent une vraie base PostgreSQL jetable : le nom doit contenir `test` car le schéma y est recréé à chaque fichier de test.

```bash
createdb gamingbox_test
TEST_DATABASE_URL=postgresql://postgres@localhost/gamingbox_test npm test
```

Sur PostgreSQL antérieur à 18, un `uuidv7()` de remplacement est créé automatiquement pour les tests. La CI (`.github/workflows/ci.yml`) lance lint, format, tests et `npm audit` sur PostgreSQL 18.

## Configuration

Voir `.env.example`. En production, `SESSION_SECRET` et `CSRF_SECRET` (32 caractères minimum) sont obligatoires : l'application refuse de démarrer sans eux. La vérification du certificat TLS de la base reste active (`DB_SSL_REJECT_UNAUTHORIZED=false` seulement si l'hébergeur l'impose). Sans `SMTP_HOST`, les emails sont écrits dans les logs.

## Architecture

```
app.js                     démarrage du serveur
src/app.js                 construction de l'application Express (testable)
src/config/                env validé, logger, base, session, sécurité (CSRF, limiteurs, CSP)
src/routes/                routes par zone : public, user, admin
src/controller/            contrôleurs HTTP (fins)
src/services/              règles métier (propriété, expiration, import, mails...)
src/repositories/          accès PostgreSQL (requêtes paramétrées uniquement)
src/validators/            schémas Zod
src/views/                 EJS
database/                  schéma de base, vues, seeders, patches
tests/                     node:test + supertest sur PostgreSQL
```

Principes : les erreurs métier sont des `AppError` (statut + message affichable) traduites par le handler global ; toute ressource d'un utilisateur est lue et modifiée avec son `user_id` dans la requête SQL.

## Limites connues

- Pas encore d'import automatique Steam (nécessite une clé d'API Steam et un consentement utilisateur)
- Pas d'intégration d'un service de suivi d'erreurs (Sentry ou équivalent) : à brancher dans `src/middlewares/errorMiddleware.js`
- Les sauvegardes sont à planifier sur l'hébergeur (cron ou tâche planifiée) avec `scripts/backup_db.sh`

## Licence

Le badge d'origine indique MIT, `package.json` indiquait ISC, et le fichier `LICENCE` contient actuellement un journal des modifications plutôt qu'un texte de licence : à trancher et à corriger par le mainteneur.
