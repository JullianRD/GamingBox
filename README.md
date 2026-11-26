# GamingBox - Ta liste de jeu vidéo améliorée !

- **GamingBox** est une application permettant de créer une liste de ses jeux terminé ou non et d'en poster des reviews qu'il est possible de partager à ses amis. L'application se veut être une alternative a des application comme Letterbox ou BacklogGD. 

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

**GamingBox** est une application de création de review sur des jeux vidéos (toute platforme de jeux confondu).

### 🌟 Pourquoi GamingBox ?

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

- `database/bootstrap/` : création de la base, du rôle applicatif et de ses droits (rôle administrateur).
- `database/seeders/` : données de test.

## Tests

```bash
npm test
```

Les tests d'intégration (`test/integration/`) ne tournent que si `TEST_DATABASE_URL` pointe vers une base PostgreSQL vide dédiée aux tests. Ils appliquent les migrations au début et les annulent à la fin.
