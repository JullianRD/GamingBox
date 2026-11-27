"use strict";

import { AppError } from "../utils/AppError.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un identifiant mal formé donne une 404 au lieu d'une erreur PostgreSQL
export const requireUuidParams =
  (...names) =>
  (req, res, next) => {
    const invalid = names.some((name) => req.params[name] !== undefined && !UUID.test(req.params[name]));
    return invalid ? next(new AppError("Page introuvable.", 404)) : next();
  };

