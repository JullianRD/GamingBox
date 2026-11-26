"use strict";

import { Router } from "express";
import ChallengeService, { DUEL_MODES, BLINDTEST_MODES } from "./ChallengeService.js";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { doubleCsrfProtection } from "../../config/security.js";
import { requireUuidParams } from "../../middlewares/uuidParams.js";

/**
 * Onglet Défis : duels « Tu préfères » et blindtest.
 * La partie en cours est gardée en session (une de chaque à la fois).
 */

const router = Router();
router.use("/defis", requireAuth);

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const isHtmx = (req) => Boolean(req.get("HX-Request"));

// Après la dernière action, l'écran de résultat remplace la partie
const goToResult = (req, res, resultId) => {
  const url = `/defis/resultats/${resultId}`;
  if (isHtmx(req)) {
    res.set("HX-Redirect", url);
    return res.status(204).end();
  }
  return res.redirect(url);
};

const startOrFlash = (start, key, path) =>
  wrap(async (req, res) => {
    try {
      req.session[key] = await start(req.session.userId, req.body);
      res.redirect(path);
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) throw error;
      req.flash("error", error.message);
      res.redirect("/defis");
    }
  });

router.get(
  "/defis",
  wrap(async (req, res) => {
    const userId = req.session.userId;
    const [recent, board] = await Promise.all([ChallengeService.recentResults(userId), ChallengeService.leaderboard(userId)]);
    res.render("pages/challenges/index", {
      title: "Défis - Cocon",
      duelModes: DUEL_MODES,
      blindtestModes: BLINDTEST_MODES,
      recent,
      board,
      duelInProgress: Boolean(req.session.duel),
      blindtestInProgress: Boolean(req.session.blindtest),
    });
  }),
);

// ── Duels ──
router.post("/defis/duel", doubleCsrfProtection, startOrFlash((u, b) => ChallengeService.startDuel(u, b), "duel", "/defis/duel"));

router.get("/defis/duel", (req, res) => {
  if (!req.session.duel) return res.redirect("/defis");
  res.render("pages/challenges/duel", { title: "Tu préfères - Cocon", duel: ChallengeService.duelView(req.session.duel) });
});

router.post(
  "/defis/duel/choix",
  doubleCsrfProtection,
  wrap(async (req, res) => {
    if (!req.session.duel) return isHtmx(req) ? res.set("HX-Redirect", "/defis").status(204).end() : res.redirect("/defis");
    const { state, resultId } = await ChallengeService.chooseInDuel(req.session.userId, req.session.duel, req.body.pick);
    if (resultId) {
      delete req.session.duel;
      return goToResult(req, res, resultId);
    }
    req.session.duel = state;
    const duel = ChallengeService.duelView(state);
    if (isHtmx(req)) return res.render("partials/challenges/duel-round", { layout: false, duel });
    res.redirect("/defis/duel");
  }),
);

router.post("/defis/duel/abandon", doubleCsrfProtection, (req, res) => {
  delete req.session.duel;
  res.redirect("/defis");
});

// ── Blindtest ──
router.post(
  "/defis/blindtest",
  doubleCsrfProtection,
  startOrFlash((u, b) => ChallengeService.startBlindtest(u, b), "blindtest", "/defis/blindtest"),
);

router.get("/defis/blindtest", (req, res) => {
  if (!req.session.blindtest) return res.redirect("/defis");
  res.render("pages/challenges/blindtest", { title: "Blindtest - Cocon", quiz: ChallengeService.blindtestView(req.session.blindtest) });
});

router.post("/defis/blindtest/reponse", doubleCsrfProtection, (req, res) => {
  if (!req.session.blindtest) return res.redirect("/defis");
  req.session.blindtest = ChallengeService.answerBlindtest(req.session.blindtest, req.body.choice);
  const quiz = ChallengeService.blindtestView(req.session.blindtest);
  if (isHtmx(req)) return res.render("partials/challenges/question", { layout: false, quiz });
  res.redirect("/defis/blindtest");
});

router.post(
  "/defis/blindtest/suivant",
  doubleCsrfProtection,
  wrap(async (req, res) => {
    if (!req.session.blindtest) return res.redirect("/defis");
    const { state, resultId } = await ChallengeService.nextBlindtest(req.session.userId, req.session.blindtest);
    if (resultId) {
      delete req.session.blindtest;
      return goToResult(req, res, resultId);
    }
    req.session.blindtest = state;
    const quiz = ChallengeService.blindtestView(state);
    if (isHtmx(req)) return res.render("partials/challenges/question", { layout: false, quiz });
    res.redirect("/defis/blindtest");
  }),
);

router.post("/defis/blindtest/abandon", doubleCsrfProtection, (req, res) => {
  delete req.session.blindtest;
  res.redirect("/defis");
});

router.get(
  "/defis/resultats/:resultId",
  requireUuidParams("resultId"),
  wrap(async (req, res) => {
    const result = await ChallengeService.getResult(req.params.resultId, req.session.userId);
    res.render("pages/challenges/result", { title: `${result.title} - Défis - Cocon`, result });
  }),
);

export default router;
