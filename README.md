# Cocon - ton cocon de jeux, de films et de lectures

**Cocon** (anciennement GamingBox) est une application pour tenir la liste de ce que tu joues, regardes et lis, noter, écrire tes reviews et les partager à tes amis. Elle se veut une alternative douce à des applications comme Letterboxd ou Backloggd.

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Table des matières

- [🎯 Objectif du projet](#-objectif-du-projet)
- [✨ Fonctionnalités](#-fonctionnalités)
- [🛠 Stack Technique](#-stack-technique)
- [📁 Architecture du projet](#-architecture-du-projet)
- [🚀 Installation & Démarrage](#-installation--démarrage)
- [📚 Documentation](#-documentation)
- [🛡️ Sécurité](#️-sécurité)
- [🎓 Exercices pratiques](#-exercices-pratiques)
- [📊 Modèle de données](#-modèle-de-données)
- [🧪 Scripts utilitaires](#-scripts-utilitaires)
- [🤝 Contribution](#-contribution)
- [📝 License](#-license)

---

## 🎯 Objectif du projet

**Cocon** est une application de listes et de reviews : jeux vidéo aujourd'hui, films ensuite, livres plus tard.

### Pourquoi Cocon ?

Pour avoir une liste compléte et interactive partout avec sois, simple d'utlisation, pratique à utiliser et agréable à partager.
---

## Base de données

Le schéma est géré par des migrations versionnées ([node-pg-migrate](https://salsita.github.io/node-pg-migrate/)), en SQL, dans `migrations/`. PostgreSQL 18 minimum (`uuidv7()` natif).

| Commande | Rôle |
| --- | --- |
| `bash scripts/init_db.sh` | Crée la base et le rôle applicatif, applique les migrations, donne les droits, propose les données de test |
| `npm run db:migrate` | Applique les migrations en attente (`DATABASE_URL`) |
| `npm run db:migrate:down` | Annule la dernière migration (`-- 0` pour tout annuler) |
| `npm run db:migrate:create -- nom-de-la-migration` | Crée un fichier SQL avec ses sections `-- Up Migration` et `-- Down Migration` |

Une migration déjà appliquée ne se modifie plus : toute évolution du schéma passe par une nouvelle migration.

- `database/bootstrap/` : création de la base, du rôle applicatif et de ses droits (rôle administrateur, en local).
- `scripts/migrate.js` : utilise `DATABASE_URL_UNPOOLED` s'il est défini, sinon `DATABASE_URL`.

### Héberger la base sur Neon

1. Créer un projet sur [neon.com](https://neon.com) en PostgreSQL 18, dans la région la plus proche de l'hébergeur de l'app (par exemple Francfort).
2. Créer une branche `dev` pour le développement, la branche principale servant à la production.
3. Copier les deux chaînes de connexion de chaque branche dans le `.env` (ou les variables de l'hébergeur) :
   - `DATABASE_URL` : l'URL **avec pooler** (hôte en `-pooler`), utilisée par l'app ;
   - `DATABASE_URL_UNPOOLED` : l'URL **directe**, utilisée par les migrations, car le pooler ne garde pas le verrou que pose `node-pg-migrate`.
4. Lancer `npm run db:migrate`.

Les URL Neon contiennent `sslmode=require` : le SSL s'active alors tout seul, avec vérification des certificats. `DB_SSL` et `DB_SSL_REJECT_UNAUTHORIZED` permettent de forcer un autre comportement. `DB_POOL_MAX` règle la taille du pool local (10 par défaut).

Sur Neon, la base et le rôle propriétaire sont créés depuis la console : `database/bootstrap/` ne sert qu'en local. Pour tester une migration risquée, créer une branche Neon depuis la production, y appliquer la migration, puis supprimer la branche.
- `database/seeders/` : données de test.

## Tests

```bash
npm test
```

Les tests d'intégration (`test/integration/`) ne tournent que si `TEST_DATABASE_URL` pointe vers une base PostgreSQL vide dédiée aux tests. Ils appliquent les migrations au début et les annulent à la fin.
