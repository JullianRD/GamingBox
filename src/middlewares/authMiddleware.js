"use strict";
/**
 * Middleware d'authentification et de gestion de session
 *
 * @module middlewares/authMiddleware
 */

/**
 * Injecte les données de l'utilisateur connecté dans res.locals
 * Cela rend la variable `currentUser` accessible dans toutes les vues EJS
 * Doit être placé après le middleware de session et avant les routes.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const injectUserToLocals = (req, res, next) => {
  const isLoggedIn = Boolean(req.session?.userId);

  res.locals.currentUser = isLoggedIn
    ? {
        id: req.session.userId,
        email: req.session.email,
        pseudo: req.session.pseudo,
        role: req.session.roleName,
        avatar: req.session.avatar,
      }
    : null;

  res.locals.isAdmin = isLoggedIn && req.session.roleName === "admin";

  next();
};

/**
 * Vérifie si l'utilisateur est connecté
 * Si non, redirige vers la page de connexion
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
};

/**
 * Vérifie si l'utilisateur est un visiteur (non connecté)
 * Si connecté, redirige vers le compte
 * Utile pour les pages login/register
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const requireGuest = (req, res, next) => {
  console.log("requireGuest hit", {
    session: req.session,
    userId: req.session?.userId,
  });

  if (req.session.userId) {
    return res.redirect("/reviews");
  }

  next();
};

/**
 * Vérifie si l'utilisateur est admin
 * Si non, redirige vers les reviews
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const requireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  if (req.session.roleName !== "admin") {
    if (req.originalUrl !== "/favicon.ico") {
      req.flash("error", "Accès réservé aux administrateurs.");
    }
    return res.redirect("/reviews");
  }

  next();
};