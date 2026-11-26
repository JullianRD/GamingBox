"use strict";

import db from "../config/database.js";

const REVIEW_SELECT = /*sql*/ `
  r.id_review, r.review_title, r.slug, r.avis_review, r.review_rate, r.progression_status,
  r.game_platforme, r.review_like, r.review_platine, r.created_at,
  g.game_title, g.thumbnail_url, g.game_genre,
  u.pseudo AS author_pseudo, u.avatar AS author_avatar,
  (SELECT COUNT(*) FROM review_likes l WHERE l.review_id = r.id_review)::int AS like_count,
  EXISTS (SELECT 1 FROM review_likes l WHERE l.review_id = r.id_review AND l.user_id = $1) AS liked_by_viewer`;

const mapReview = (row) => ({
  id: row.id_review,
  reviewTitle: row.review_title,
  slug: row.slug,
  avisReview: row.avis_review,
  reviewRate: row.review_rate,
  progressionStatus: row.progression_status,
  gamePlatforme: row.game_platforme,
  reviewLike: row.review_like,
  reviewPlatine: row.review_platine,
  createdAt: row.created_at,
  gameTitle: row.game_title,
  thumbnailUrl: row.thumbnail_url,
  gameGenre: row.game_genre,
  authorPseudo: row.author_pseudo,
  authorAvatar: row.author_avatar,
  likeCount: row.like_count,
  likedByViewer: row.liked_by_viewer,
});

// Un viewer anonyme est représenté par un UUID nul : aucun like ne lui correspond
const NO_VIEWER = "00000000-0000-0000-0000-000000000000";

class SocialRepository {
  // Profil visible uniquement si l'utilisateur l'a rendu public
  static async findPublicProfile(pseudo, viewerId = null) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT u.id_user, u.pseudo, u.avatar, u.biographie, u.created_at,
          (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id_user AND r.is_public)::int AS public_reviews,
          (SELECT COUNT(*) FROM user_follows f WHERE f.followed_id = u.id_user)::int AS followers,
          (SELECT COUNT(*) FROM user_follows f WHERE f.follower_id = u.id_user)::int AS following,
          EXISTS (SELECT 1 FROM user_follows f WHERE f.followed_id = u.id_user AND f.follower_id = $2) AS followed_by_viewer
        FROM users u
        WHERE u.pseudo = $1 AND u.profile_public`,
      [pseudo, viewerId ?? NO_VIEWER],
    );
    const row = rows[0];
    return row
      ? {
          id: row.id_user,
          pseudo: row.pseudo,
          avatar: row.avatar,
          biographie: row.biographie,
          createdAt: row.created_at,
          publicReviews: row.public_reviews,
          followers: row.followers,
          following: row.following,
          followedByViewer: row.followed_by_viewer,
        }
      : null;
  }

  static async publicReviews(userId, viewerId = null, { page = 1, perPage = 12 } = {}) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT ${REVIEW_SELECT}, COUNT(*) OVER() AS total_count
        FROM reviews r JOIN games g ON g.id_game = r.game_id JOIN users u ON u.id_user = r.user_id
        WHERE r.user_id = $2 AND r.is_public AND u.profile_public
        ORDER BY r.created_at DESC LIMIT $3 OFFSET $4`,
      [viewerId ?? NO_VIEWER, userId, perPage, (page - 1) * perPage],
    );
    return { items: rows.map(mapReview), total: rows[0] ? Number(rows[0].total_count) : 0 };
  }

  static async publicReviewBySlug(pseudo, slug, viewerId = null) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT ${REVIEW_SELECT}
        FROM reviews r JOIN games g ON g.id_game = r.game_id JOIN users u ON u.id_user = r.user_id
        WHERE u.pseudo = $2 AND r.slug = $3 AND r.is_public AND u.profile_public`,
      [viewerId ?? NO_VIEWER, pseudo, slug],
    );
    return rows[0] ? mapReview(rows[0]) : null;
  }

  static async follow(followerId, followedId) {
    const { rowCount } = await db.query(
      "INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [followerId, followedId],
    );
    return rowCount > 0;
  }

  static async unfollow(followerId, followedId) {
    const result = await db.query(
      "DELETE FROM user_follows WHERE follower_id = $1 AND followed_id = $2",
      [followerId, followedId],
    );
    return result.rowCount > 0;
  }

  // Fil d'actualité : reviews publiques des utilisateurs suivis (profils publics uniquement)
  static async feed(viewerId, { page = 1, perPage = 12 } = {}) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT ${REVIEW_SELECT}, COUNT(*) OVER() AS total_count
        FROM user_follows f
        JOIN reviews r ON r.user_id = f.followed_id AND r.is_public
        JOIN games g ON g.id_game = r.game_id
        JOIN users u ON u.id_user = r.user_id AND u.profile_public
        WHERE f.follower_id = $1
        ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
      [viewerId, perPage, (page - 1) * perPage],
    );
    return { items: rows.map(mapReview), total: rows[0] ? Number(rows[0].total_count) : 0 };
  }

  // Like / unlike d'une review publique (profil et review publics requis)
  static async toggleLike(viewerId, pseudo, slug) {
    const { rows } = await db.query(
      /*sql*/ `
        SELECT r.id_review FROM reviews r JOIN users u ON u.id_user = r.user_id
        WHERE u.pseudo = $1 AND r.slug = $2 AND r.is_public AND u.profile_public`,
      [pseudo, slug],
    );
    if (!rows[0]) return null;

    const reviewId = rows[0].id_review;
    const removed = await db.query(
      "DELETE FROM review_likes WHERE user_id = $1 AND review_id = $2",
      [viewerId, reviewId],
    );
    if (removed.rowCount === 0) {
      await db.query(
        "INSERT INTO review_likes (user_id, review_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [viewerId, reviewId],
      );
    }
    return { liked: removed.rowCount === 0 };
  }
}

export default SocialRepository;
