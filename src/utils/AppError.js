"use strict";
/**
 * Classe d'erreur métier standarisée
 * Permet de distinguer les bugs (500) et des erreurs gérées (404, 403, 400)
 */
export class AppError extends Error { // Hérite de la class Error native de JS
  constructor(message, statusCode) { // Genre throw nex Error("review introuvable, 404")
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true; // Indique une erreur prévue (ex: saisie invalide) // Middleware // On peut afficher un message d'erreur perso

    Error.captureStackTrace(this, this.constructor);
  }
}

const myError = new AppError("Erreur test", 400);


// AppError permet de :

// ✔ créer des erreurs métier propres
// ✔ différencier bug vs erreur utilisateur
// ✔ gérer les codes HTTP correctement
// ✔ centraliser la gestion d’erreur