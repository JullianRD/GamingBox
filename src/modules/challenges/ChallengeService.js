"use strict";

import db from "../../config/database.js";
import DiscoverService from "../discover/DiscoverService.js";
import SocialService from "../social/SocialService.js";
import { getProvider } from "../catalog/providers/index.js";
import { mapLimit } from "../catalog/http.js";
import { createBracket, bracketSize, shuffle, choose, ranking, currentPair, progress } from "./bracket.js";
import { buildQuiz, makeQuestion, publicQuestion, QUESTIONS } from "./quiz.js";
import { AppError } from "../../utils/AppError.js";
import { ITEM_TYPES } from "../../utils/itemTypes.js";
import { logger } from "../../config/logger.js";

export const DUEL_MODES = {
  library: { label: "Ma bibliothèque", needsType: false },
  characters: { label: "Personnages", needsType: false },
  openings: { label: "Openings d'anime", needsType: false },
  trending: { label: "Tendances du moment", needsType: true },
};

export const BLINDTEST_MODES = {
  covers: { label: "Devine la jaquette", hint: "Une jaquette floutée, quatre titres." },
  music: { label: "Musique", hint: "30 secondes d'un titre du moment ou de tes albums." },
  openings: { label: "Openings d'anime", hint: "Un opening, à toi de trouver l'anime." },
};

const typeLabel = (type) => (type ? ITEM_TYPES[type]?.plural : null);

// ── Participants des duels ─────────────────────────────────────

const libraryPool = async (userId, type) => {
  const { rows } = await db.query(
    `
      SELECT i.id_item, i.title, i.cover_url, i.item_type
      FROM user_items ui JOIN items i ON i.id_item = ui.item_id
      WHERE ui.user_id = $1 AND ($2::item_type_enum IS NULL OR i.item_type = $2) AND ui.status <> 'planned'
      ORDER BY ui.is_favorite DESC, ui.rating DESC NULLS LAST, random()
      LIMIT 64
    `,
    [userId, type],
  );
  return rows.map((r) => ({ key: r.id_item, itemId: r.id_item, title: r.title, imageUrl: r.cover_url, subtitle: ITEM_TYPES[r.item_type].label, type: r.item_type }));
};

const entityPool = async (userId, kind, type) => {
  const { rows } = await db.query(
    `
      SELECT DISTINCT ON (e.id_entity) e.id_entity, e.name, e.image_url, i.title AS item_title, i.cover_url, i.item_type,
             (f.entity_id IS NOT NULL) AS favorite
      FROM user_items ui
      JOIN items i ON i.id_item = ui.item_id
      JOIN item_entities ie ON ie.item_id = i.id_item
      JOIN entities e ON e.id_entity = ie.entity_id AND e.entity_kind = $2
      LEFT JOIN user_favorite_entities f ON f.entity_id = e.id_entity AND f.user_id = ui.user_id
      WHERE ui.user_id = $1 AND ($3::item_type_enum IS NULL OR i.item_type = $3)
      ORDER BY e.id_entity
    `,
    [userId, kind, type],
  );
  return shuffle(rows)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
    .map((r) => ({ key: r.id_entity, title: r.name, imageUrl: r.image_url || r.cover_url, subtitle: r.item_title }));
};

const trendingPool = async (type) =>
  (await DiscoverService.getTrending(type)).map((c) => ({ key: `${c.source}:${c.externalId}`, title: c.title, imageUrl: c.coverUrl, subtitle: ITEM_TYPES[type].label, href: c.href }));

// ── Questions du blindtest ─────────────────────────────────────

const coversPool = async (userId) => {
  const { rows } = await db.query(
    `
      (SELECT i.title, i.cover_url, i.item_type FROM user_items ui JOIN items i ON i.id_item = ui.item_id
        WHERE ui.user_id = $1 AND i.cover_url IS NOT NULL ORDER BY random() LIMIT 30)
      UNION
      (SELECT title, cover_url, item_type FROM items WHERE cover_url IS NOT NULL ORDER BY random() LIMIT 30)
    `,
    [userId],
  );
  return rows.map((r) => ({
    label: r.title,
    prompt: `Quel ${ITEM_TYPES[r.item_type].label.toLowerCase()} se cache derrière cette jaquette ?`,
    media: { kind: "image", url: r.cover_url },
  }));
};

const musicPool = async (userId) => {
  const deezer = getProvider("deezer");
  const { rows } = await db.query(
    `SELECT i.external_id FROM user_items ui JOIN items i ON i.id_item = ui.item_id
     WHERE ui.user_id = $1 AND i.source = 'deezer' ORDER BY random() LIMIT 4`,
    [userId],
  );
  const lists = await Promise.allSettled([deezer.chartTracks(50), ...rows.map((r) => deezer.albumTracks(r.external_id))]);
  return lists
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((t) => t.preview)
    .map((t) => ({ label: `${t.title} — ${t.artist}`, prompt: "Quel est ce titre ?", media: { kind: "audio", url: t.preview, cover: t.cover } }));
};

const openingsPool = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT e.name, e.metadata, i.title AS anime, (ui.user_id IS NOT NULL) AS mine
      FROM entities e
      JOIN item_entities ie ON ie.entity_id = e.id_entity
      JOIN items i ON i.id_item = ie.item_id AND i.item_type = 'anime'
      LEFT JOIN user_items ui ON ui.item_id = i.id_item AND ui.user_id = $1
      WHERE e.entity_kind = 'song' AND ie.role LIKE 'Opening%'
      ORDER BY (ui.user_id IS NOT NULL) DESC, random()
      LIMIT 40
    `,
    [userId],
  );
  const deezer = getProvider("deezer");
  const found = await mapLimit(rows.slice(0, 24), 3, async (r) => {
    const query = [r.metadata?.title?.replace(/\s*\(.*\)\s*$/, ""), r.metadata?.artist].filter(Boolean).join(" ") || r.name;
    const [track] = await deezer.searchTracks(query, 1).catch(() => []);
    return track?.preview ? { label: r.anime, prompt: "De quel anime vient cet opening ?", media: { kind: "audio", url: track.preview }, reveal: `${r.anime} · ${r.name}` } : null;
  });
  // Les leurres viennent de tous les anime connus, même sans extrait
  const decoys = rows.map((r) => ({ label: r.anime }));
  return { answers: found.filter(Boolean), decoys };
};

class ChallengeService {
  // ── Duels ──
  static async startDuel(userId, { mode, type, size }) {
    if (!DUEL_MODES[mode]) throw new AppError("Mode de duel inconnu.", 400);
    const itemType = ITEM_TYPES[type]?.enabled ? type : null;
    if (DUEL_MODES[mode].needsType && !itemType) throw new AppError("Choisis une catégorie pour les tendances.", 400);

    let pool;
    if (mode === "library") pool = await libraryPool(userId, itemType);
    else if (mode === "characters") pool = await entityPool(userId, "character", itemType);
    else if (mode === "openings") pool = await entityPool(userId, "song", "anime");
    else pool = await trendingPool(itemType);

    const finalSize = bracketSize(Number(size) || 8, pool.length);
    if (!finalSize) {
      throw new AppError(
        mode === "trending"
          ? "Les tendances sont indisponibles pour le moment."
          : "Pas assez d'éléments pour un duel (il en faut au moins 4). Ajoute des œuvres ou ouvre leurs fiches pour charger personnages et openings.",
        400,
      );
    }
    const contenders = shuffle(pool.slice(0, Math.max(finalSize, Math.min(pool.length, finalSize * 2)))).slice(0, finalSize);
    const title = [DUEL_MODES[mode].label, typeLabel(itemType)].filter(Boolean).join(" · ");
    return { mode, type: itemType, title, ...createBracket(contenders) };
  }

  static duelView(state) {
    return { title: state.title, pair: currentPair(state), progress: progress(state) };
  }

  static async chooseInDuel(userId, state, pick) {
    const next = choose(state, pick);
    if (next.champion === null) return { state: next, resultId: null };
    const order = ranking(next);
    const resultId = await this.saveResult(userId, {
      game: "duel",
      mode: next.mode,
      itemType: next.type,
      title: next.title,
      total: next.contenders.length,
      payload: { champion: order[0], ranking: order },
    });
    await SocialService.record({
      userId,
      kind: "challenged",
      itemId: order[0].itemId ?? null,
      payload: { resultId, game: "duel", title: next.title, champion: order[0].title },
    });
    return { state: next, resultId };
  }

  // ── Blindtest ──
  static async startBlindtest(userId, { mode }) {
    if (!BLINDTEST_MODES[mode]) throw new AppError("Mode de blindtest inconnu.", 400);
    let questions = [];
    try {
      if (mode === "covers") questions = buildQuiz(await coversPool(userId));
      else if (mode === "music") questions = buildQuiz(await musicPool(userId));
      else {
        const { answers, decoys } = await openingsPool(userId);
        const seen = new Set();
        questions = shuffle(answers)
          .filter((a) => !seen.has(a.label) && seen.add(a.label))
          .map((a) => makeQuestion(a, decoys))
          .filter(Boolean)
          .slice(0, QUESTIONS);
      }
    } catch (error) {
      logger.warn({ err: error, mode }, "Blindtest indisponible");
    }
    if (questions.length < 3) {
      throw new AppError(
        mode === "covers"
          ? "Pas assez de jaquettes pour jouer : ajoute quelques œuvres d'abord."
          : "Les extraits audio sont indisponibles pour le moment (Deezer injoignable, ou pas assez d'openings connus).",
        400,
      );
    }
    return { mode, title: BLINDTEST_MODES[mode].label, questions, index: 0, score: 0, answers: [], answered: false };
  }

  static blindtestView(state) {
    const question = state.questions[state.index];
    return {
      title: state.title,
      number: state.index + 1,
      total: state.questions.length,
      score: state.score,
      question: publicQuestion(question),
      answered: state.answered,
      last: state.answers.at(-1) ?? null,
    };
  }

  static answerBlindtest(state, choice) {
    if (state.answered) return state;
    const question = state.questions[state.index];
    const correct = Number(choice) === question.answer;
    return {
      ...state,
      score: state.score + (correct ? 1 : 0),
      answered: true,
      answers: [...state.answers, { choice: Number(choice), correct, answer: question.answer, reveal: question.reveal }],
    };
  }

  static async nextBlindtest(userId, state) {
    if (!state.answered) return { state, resultId: null };
    if (state.index + 1 < state.questions.length) return { state: { ...state, index: state.index + 1, answered: false }, resultId: null };
    const resultId = await this.saveResult(userId, {
      game: "blindtest",
      mode: state.mode,
      title: state.title,
      score: state.score,
      total: state.questions.length,
      payload: { recap: state.questions.map((q, i) => ({ reveal: q.reveal, correct: state.answers[i]?.correct ?? false })) },
    });
    await SocialService.record({
      userId,
      kind: "challenged",
      payload: { resultId, game: "blindtest", title: state.title, score: state.score, total: state.questions.length },
    });
    return { state: null, resultId };
  }

  // ── Résultats ──
  static async saveResult(userId, { game, mode, itemType = null, title, score = null, total, payload }) {
    const { rows } = await db.query(
      `INSERT INTO challenge_results (user_id, game, mode, item_type, title, score, total, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_challenge_result`,
      [userId, game, mode, itemType, title.slice(0, 150), score, total, payload],
    );
    return rows[0].id_challenge_result;
  }

  static async getResult(resultId, viewerId) {
    const { rows } = await db.query(
      `SELECT r.*, u.pseudo, u.is_public FROM challenge_results r JOIN users u ON u.id_user = r.user_id WHERE r.id_challenge_result = $1`,
      [resultId],
    );
    const row = rows[0];
    if (!row || (row.user_id !== viewerId && !row.is_public)) throw new AppError("Résultat introuvable.", 404);
    return {
      id: row.id_challenge_result,
      game: row.game,
      mode: row.mode,
      title: row.title,
      score: row.score,
      total: row.total,
      payload: row.payload,
      createdAt: row.created_at,
      owner: { id: row.user_id, pseudo: row.pseudo },
      isMine: row.user_id === viewerId,
    };
  }

  static async recentResults(userId, limit = 6) {
    const { rows } = await db.query(
      `SELECT id_challenge_result AS id, game, title, score, total, payload->'champion'->>'title' AS champion, created_at AS "createdAt"
       FROM challenge_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }

  // Meilleur score de chacun (moi et mes amis) par mode de blindtest
  static async leaderboard(userId) {
    const { rows } = await db.query(
      `
        WITH people AS (
          SELECT $1::uuid AS id
          UNION SELECT f1.followed_id FROM follows f1
            JOIN follows f2 ON f2.follower_id = f1.followed_id AND f2.followed_id = f1.follower_id
            WHERE f1.follower_id = $1
        )
        SELECT DISTINCT ON (r.mode, r.user_id) r.mode, r.user_id, u.pseudo, u.avatar, r.score, r.total
        FROM challenge_results r JOIN people p ON p.id = r.user_id JOIN users u ON u.id_user = r.user_id
        WHERE r.game = 'blindtest'
        ORDER BY r.mode, r.user_id, (r.score::float / r.total) DESC, r.created_at
      `,
      [userId],
    );
    const board = {};
    for (const row of rows) (board[row.mode] ??= []).push({ pseudo: row.pseudo, avatar: row.avatar, id: row.user_id, score: row.score, total: row.total, isMe: row.user_id === userId });
    for (const list of Object.values(board)) list.sort((a, b) => b.score / b.total - a.score / a.total);
    return board;
  }
}

export default ChallengeService;
