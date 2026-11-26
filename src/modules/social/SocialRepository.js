"use strict";

import db from "../../config/database.js";

const toUser = (row) =>
  row
    ? {
        id: row.id_user,
        pseudo: row.pseudo,
        biographie: row.biographie,
        avatar: row.avatar,
        isPublic: row.is_public,
        href: `/u/${encodeURIComponent(row.pseudo)}`,
        createdAt: row.created_at,
      }
    : null;

const toComment = (row) => ({
  id: row.id_comment,
  body: row.body,
  createdAt: row.created_at,
  author: toUser({ id_user: row.author_id, pseudo: row.author_pseudo, avatar: row.author_avatar }),
});

const toActivity = (row) => ({
  id: row.id_activity,
  kind: row.kind,
  createdAt: row.created_at,
  payload: row.payload ?? {},
  user: toUser({ id_user: row.user_id, pseudo: row.user_pseudo, avatar: row.user_avatar }),
  item: row.item_id
    ? { id: row.item_id, type: row.item_type, title: row.item_title, coverUrl: row.item_cover_url }
    : null,
  entryHref: row.user_item_id ? `/entrees/${row.user_item_id}` : null,
  list: row.list_id
    ? { title: row.list_title, href: `/u/${encodeURIComponent(row.user_pseudo)}/listes/${row.list_slug}` }
    : null,
  target: row.target_pseudo ? toUser({ id_user: row.target_user_id, pseudo: row.target_pseudo }) : null,
});

const SELECT_ACTIVITY = `
  SELECT a.*, u.pseudo AS user_pseudo, u.avatar AS user_avatar,
    i.item_type, i.title AS item_title, i.cover_url AS item_cover_url,
    l.title AS list_title, l.slug AS list_slug,
    t.pseudo AS target_pseudo
  FROM activities a
  JOIN users u ON u.id_user = a.user_id
  LEFT JOIN items i ON i.id_item = a.item_id
  LEFT JOIN lists l ON l.id_list = a.list_id
  LEFT JOIN users t ON t.id_user = a.target_user_id
`;

class SocialRepository {
  // ── Utilisateurs ────────────────────────────────────────────
  static async findUserByPseudo(pseudo) {
    const { rows } = await db.query(`SELECT * FROM users WHERE pseudo = $1`, [pseudo]);
    return toUser(rows[0]);
  }

  static async findUserById(userId) {
    const { rows } = await db.query(`SELECT * FROM users WHERE id_user = $1`, [userId]);
    return toUser(rows[0]);
  }

  static async searchUsers(query, viewerId, limit = 8) {
    const { rows } = await db.query(
      `
        SELECT * FROM users
        WHERE is_public AND id_user <> $2 AND pseudo ILIKE '%' || $1 || '%'
        ORDER BY similarity(pseudo::text, $1) DESC, pseudo
        LIMIT $3
      `,
      [query, viewerId, limit],
    );
    return rows.map(toUser);
  }

  static async setPublic(userId, isPublic) {
    await db.query(`UPDATE users SET is_public = $2 WHERE id_user = $1`, [userId, isPublic]);
  }

  static async getProfileStats(userId) {
    const { rows } = await db.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM user_items WHERE user_id = $1) AS entries,
          (SELECT COUNT(*)::int FROM user_items WHERE user_id = $1 AND status = 'completed') AS completed,
          (SELECT COUNT(*)::int FROM follows WHERE followed_id = $1) AS followers,
          (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) AS following
      `,
      [userId],
    );
    return rows[0];
  }

  // ── Abonnements ─────────────────────────────────────────────
  static async getRelation(viewerId, userId) {
    const { rows } = await db.query(
      `
        SELECT
          EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2) AS following,
          EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followed_id = $1) AS followed_by
      `,
      [viewerId, userId],
    );
    const { following, followed_by: followedBy } = rows[0];
    return { following, followedBy, friends: following && followedBy };
  }

  static async follow(followerId, followedId) {
    const { rowCount } = await db.query(
      `INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [followerId, followedId],
    );
    return rowCount > 0;
  }

  static async unfollow(followerId, followedId) {
    await db.query(`DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2`, [
      followerId,
      followedId,
    ]);
  }

  // Abonnements, abonnés et amis (réciproques) d'un utilisateur
  static async getConnections(userId) {
    const { rows } = await db.query(
      `
        SELECT u.*, 
          EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followed_id = u.id_user) AS i_follow,
          EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id_user AND f.followed_id = $1) AS follows_me
        FROM users u
        WHERE u.id_user IN (
          SELECT followed_id FROM follows WHERE follower_id = $1
          UNION SELECT follower_id FROM follows WHERE followed_id = $1
        )
        ORDER BY u.pseudo
      `,
      [userId],
    );
    const people = rows.map((row) => ({ ...toUser(row), iFollow: row.i_follow, followsMe: row.follows_me }));
    return {
      friends: people.filter((p) => p.iFollow && p.followsMe),
      following: people.filter((p) => p.iFollow && !p.followsMe),
      followers: people.filter((p) => p.followsMe && !p.iFollow),
    };
  }

  static async getFriends(userId) {
    return (await this.getConnections(userId)).friends;
  }

  // ── Activité ────────────────────────────────────────────────
  // Une même action répétée sur la même entrée remplace la précédente (moins de bruit)
  static async recordActivity({
    userId,
    kind,
    userItemId = null,
    itemId = null,
    listId = null,
    targetUserId = null,
    payload = {},
  }) {
    await db.query(
      `
        DELETE FROM activities
        WHERE user_id = $1 AND kind = $2
          AND user_item_id IS NOT DISTINCT FROM $3
          AND list_id IS NOT DISTINCT FROM $4
          AND target_user_id IS NOT DISTINCT FROM $5
          AND created_at > now() - interval '1 hour'
      `,
      [userId, kind, userItemId, listId, targetUserId],
    );
    await db.query(
      `
        INSERT INTO activities (user_id, kind, user_item_id, item_id, list_id, target_user_id, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [userId, kind, userItemId, itemId, listId, targetUserId, payload],
    );
  }

  // Fil : mon activité et celle des personnes que je suis (profils publics)
  static async getFeed(userId, { before = null, limit = 30 } = {}) {
    const { rows } = await db.query(
      `${SELECT_ACTIVITY}
        WHERE (a.user_id = $1 OR (u.is_public AND a.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)))
          AND ($2::timestamptz IS NULL OR a.created_at < $2)
          AND a.kind <> 'recommended'
        ORDER BY a.created_at DESC
        LIMIT $3`,
      [userId, before, limit],
    );
    return rows.map(toActivity);
  }

  // Activité récente des comptes suivis (sans la sienne), pour l'accueil
  static async getFriendsActivity(userId, limit = 4) {
    const { rows } = await db.query(
      `${SELECT_ACTIVITY}
        WHERE u.is_public AND a.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
          AND a.kind <> 'recommended'
        ORDER BY a.created_at DESC
        LIMIT $2`,
      [userId, limit],
    );
    return rows.map(toActivity);
  }

  static async getUserActivity(userId, limit = 12) {
    const { rows } = await db.query(
      `${SELECT_ACTIVITY} WHERE a.user_id = $1 AND a.kind <> 'recommended' ORDER BY a.created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map(toActivity);
  }

  // ── Commentaires ────────────────────────────────────────────
  static async getComments(userItemId) {
    const { rows } = await db.query(
      `
        SELECT c.*, u.pseudo AS author_pseudo, u.avatar AS author_avatar
        FROM entry_comments c JOIN users u ON u.id_user = c.author_id
        WHERE c.user_item_id = $1
        ORDER BY c.created_at
      `,
      [userItemId],
    );
    return rows.map(toComment);
  }

  static async addComment(userItemId, authorId, body) {
    const { rows } = await db.query(
      `INSERT INTO entry_comments (user_item_id, author_id, body) VALUES ($1, $2, $3) RETURNING id_comment`,
      [userItemId, authorId, body],
    );
    return rows[0].id_comment;
  }

  // Supprimable par son auteur ou par le propriétaire de l'entrée
  static async deleteComment(commentId, userId) {
    const { rows } = await db.query(
      `
        DELETE FROM entry_comments c
        USING user_items ui
        WHERE c.user_item_id = ui.id_user_item AND c.id_comment = $1
          AND (c.author_id = $2 OR ui.user_id = $2)
        RETURNING c.user_item_id
      `,
      [commentId, userId],
    );
    return rows[0]?.user_item_id ?? null;
  }

  // Entrée vue par quelqu'un d'autre que son propriétaire
  static async findEntryOwner(userItemId) {
    const { rows } = await db.query(
      `SELECT u.* FROM user_items ui JOIN users u ON u.id_user = ui.user_id WHERE ui.id_user_item = $1`,
      [userItemId],
    );
    return toUser(rows[0]);
  }
}

export default SocialRepository;
