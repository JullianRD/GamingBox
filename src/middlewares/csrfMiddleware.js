/**
 * Injecte un token CSRF dans req pour les vues SSR
 *
 * @see https://www.npmjs.com/package/csrf-csrf
 */
export function injectCsrfToken(generateToken) {
  return (req, res, next) => {
    if (typeof generateToken !== "function") {
      return next(new Error("CSRF generateToken is not a function"));
    }

    req.csrfToken = () => generateToken(req, res);
    next();
  };
}


// Ce fichier sert à protéger l'application contre les attaques CSRF et à rendre le token CSRF disponible dans tes vues EJS.
// -> Cross-Site Request Forgery / Exemple : 
// → quelqu’un peut forcer un utilisateur connecté à envoyer une requête au site.

// Exemple :

// 1️⃣ l’utilisateur est connecté à ton app
// 2️⃣ il visite un site malveillant
// 3️⃣ ce site envoie un formulaire vers ton serveur :

// Si le token est faux la requete est refusé 
// (librairie csrf-csrf)


// Ce middleware sert à :

// ✔ générer un token CSRF
// ✔ le rendre accessible dans req
// ✔ l’utiliser dans les vues EJS
// ✔ protéger les formulaires POST/PUT/DELETE



// Les routes à protéger seront typiquement :

// création review

// suppression review

// modification profil

// création tag

// partage

// Toutes les routes qui modifient des données.