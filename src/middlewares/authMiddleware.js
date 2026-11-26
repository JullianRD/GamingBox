"use strict";
/**
 * Middlewares d'authentification et d'autorisation
 *
 * @module middlewares/authMiddleware
 */

const ADMIN_ROLES = ["admin", "super_admin"];

export const isAdminRole = (roleName) => ADMIN_ROLES.includes(roleName);

/**
 * Injecte les données de l'utilisateur connecté dans res.locals
 * (variable `currentUser` disponible dans toutes les vues EJS).
 * À placer après le middleware de session et avant les routes.
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
        emailVerified: req.session.emailVerified !== false,
      }
    : null;

  res.locals.isAdmin = isLoggedIn && isAdminRole(req.session.roleName);

  next();
};

/** Redirige vers /login si l'utilisateur n'est pas connecté. */
export const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    return res.redirect("/login");
  }
  next();
};

/** Réservé aux visiteurs : un utilisateur connecté est renvoyé vers ses reviews. */
export const requireGuest = (req, res, next) => {
  if (req.session?.userId) {
    return res.redirect("/reviews");
  }
  next();
};

/** Réservé aux administrateurs. */
export const requireAdmin = (req, res, next) => {
  if (!req.session?.userId) {
    return res.redirect("/login");
  }

  if (!isAdminRole(req.session.roleName)) {
    if (req.originalUrl !== "/favicon.ico") {
      req.flash("error", "Accès réservé aux administrateurs.");
    }
    return res.redirect("/reviews");
  }

  next();
};
