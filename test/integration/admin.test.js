// Administration : rôles, suspension, fusion de doublons, édition protégée, signalements, journal
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runner } from "node-pg-migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const skip = databaseUrl ? false : "TEST_DATABASE_URL non défini";

let db;
let AdminService;
let ReportService;
let AuthService;
let ItemRepository;
let UserItemRepository;
let admin;
let alice;
let bob;

const migrate = (direction) =>
  runner({ databaseUrl, dir: "migrations", direction, count: direction === "up" ? Infinity : 0, migrationsTable: "pgmigrations", log: () => {} });

const createUser = async (pseudo, role = "customer") => {
  const { hashPassword } = await import("../../src/utils/passwordHelper.js");
  const hash = await hashPassword("Motdepasse1!");
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, pseudo, role_name, is_public) VALUES ($1, $2, $3, $4, true) RETURNING id_user`,
    [`${pseudo}@c.dev`, hash, pseudo, role],
  );
  return rows[0].id_user;
};

const audit = async (action) =>
  (await db.query(`SELECT * FROM app_events WHERE event_category = 'audit' AND event_type = $1`, [action])).rows;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = databaseUrl;
  process.env.LOG_LEVEL = "silent";
  await migrate("up");
  ({ default: db } = await import("../../src/config/database.js"));
  ({ default: AdminService } = await import("../../src/modules/admin/AdminService.js"));
  ({ default: ReportService } = await import("../../src/modules/reports/ReportService.js"));
  ({ default: AuthService } = await import("../../src/services/AuthService.js"));
  ({ default: ItemRepository } = await import("../../src/modules/catalog/ItemRepository.js"));
  ({ default: UserItemRepository } = await import("../../src/modules/library/UserItemRepository.js"));
  admin = await createUser("admine", "admin");
  alice = await createUser("alice");
  bob = await createUser("bob");
});

after(async () => {
  if (skip) return;
  await db.end();
  await migrate("down");
});

test("les rôles : pas sur soi-même, et toujours un administrateur", { skip }, async () => {
  await assert.rejects(AdminService.setRole(admin, admin, "customer"), /propre rôle/);
  await assert.rejects(AdminService.setRole(admin, alice, "root"), /Rôle inconnu/);

  await AdminService.setRole(admin, alice, "admin");
  await AdminService.setRole(alice, admin, "customer"); // alice peut rétrograder admine, il reste alice
  await assert.rejects(AdminService.setRole(admin, alice, "customer"), /au moins un administrateur/);
  await AdminService.setRole(alice, admin, "admin");
  await AdminService.setRole(admin, alice, "customer");

  const rows = await audit("user.role");
  assert.equal(rows.length, 4, "chaque changement est journalisé");
});

test("une suspension ferme les sessions et bloque la connexion", { skip }, async () => {
  await db.query(`INSERT INTO user_sessions (sid, sess, expire) VALUES ('s-bob', $1, NOW() + interval '1 day')`, [
    JSON.stringify({ userId: bob, roleName: "customer" }),
  ]);
  await assert.rejects(AdminService.suspend(admin, admin), /propre compte/);
  await AdminService.suspend(admin, bob, "spam répété");

  const sessions = await db.query(`SELECT 1 FROM user_sessions WHERE sid = 's-bob'`);
  assert.equal(sessions.rowCount, 0);
  await assert.rejects(AuthService.login({ email: "bob@c.dev", password: "Motdepasse1!" }), /suspendu/);

  await AdminService.unsuspend(admin, bob);
  const user = await AuthService.login({ email: "bob@c.dev", password: "Motdepasse1!" });
  assert.ok(user);
  const { rows } = await db.query(`SELECT last_login_at FROM users WHERE id_user = $1`, [bob]);
  assert.ok(rows[0].last_login_at, "la dernière connexion est notée");
});

test("une fusion déplace les entrées et l'ancienne source pointe vers la fiche gardée", { skip }, async () => {
  const keep = await ItemRepository.upsert({ type: "game", source: "igdb", externalId: "keep", title: "Celeste" });
  const dup = await ItemRepository.upsert({ type: "game", source: "igdb", externalId: "dup", title: "Celeste (doublon)" });
  await UserItemRepository.create(alice, dup.id, { status: "completed" });
  await UserItemRepository.create(bob, dup.id, { status: "planned" });
  await UserItemRepository.create(bob, keep.id, { status: "in_progress" });
  await db.query(`UPDATE user_items SET rating = 8 WHERE user_id = $1 AND item_id = $2`, [bob, dup.id]);

  await AdminService.mergeItems(admin, dup.id, keep.id);

  assert.equal(await ItemRepository.findById(dup.id), null, "le doublon est supprimé");
  const { rows } = await db.query(`SELECT user_id, status, rating FROM user_items WHERE item_id = $1 ORDER BY status`, [keep.id]);
  assert.equal(rows.length, 2, "une entrée par utilisateur");
  const bobEntry = rows.find((r) => r.user_id === bob);
  assert.equal(bobEntry.status, "in_progress", "l'entrée gardée prime");
  assert.equal(Number(bobEntry.rating), 8, "et se complète avec la note du doublon");

  const again = await ItemRepository.upsert({ type: "game", source: "igdb", externalId: "dup", title: "Celeste (doublon)" });
  assert.equal(again.id, keep.id, "la source ne recrée pas le doublon");
  assert.equal((await audit("item.merge")).length, 1);
});

test("une fiche corrigée à la main n'est pas écrasée par la source", { skip }, async () => {
  const item = await ItemRepository.upsert({ type: "movie", source: "tmdb", externalId: "42", title: "Titre brut" });
  await AdminService.editItem(admin, item.id, { title: "Titre corrigé", releaseDate: "2020-01-02" });
  const after = await ItemRepository.upsert({ type: "movie", source: "tmdb", externalId: "42", title: "Titre brut", releaseDate: "1999-01-01" }, { fresh: true });
  assert.equal(after.title, "Titre corrigé");
  assert.equal(after.releaseDate, "2020-01-02");
  assert.equal((await audit("item.edit")).length, 1);
});

test("signalements : pas soi-même, sans doublon, et traités par cible", { skip }, async () => {
  const item = await ItemRepository.upsert({ type: "game", source: "igdb", externalId: "rep", title: "Hollow Knight" });
  const entry = await UserItemRepository.create(alice, item.id, { status: "completed" });
  const { rows } = await db.query(
    `INSERT INTO entry_comments (user_item_id, author_id, body) VALUES ($1, $2, 'achetez mes clés') RETURNING id_comment`,
    [entry.id ?? entry, bob],
  );
  const commentId = rows[0].id_comment;

  await assert.rejects(ReportService.create(bob, { type: "comment", id: commentId, reason: "spam" }), /toi-même/);
  await assert.rejects(ReportService.create(alice, { type: "comment", id: commentId, reason: "nope" }), /motif/);
  await ReportService.create(alice, { type: "comment", id: commentId, reason: "spam" });
  await ReportService.create(alice, { type: "comment", id: commentId, reason: "spam" }); // ignoré
  await ReportService.create(admin, { type: "comment", id: commentId, reason: "other", details: "pub" });

  const open = await ReportService.list({ status: "open" });
  assert.equal(open.total, 2);
  assert.equal(open.rows[0].snapshot.body, "achetez mes clés", "le contenu est copié");

  await ReportService.resolve(admin, open.rows[0].id_report, "delete");
  assert.equal((await ReportService.list({ status: "open" })).total, 0, "les deux signalements sont clos");
  const gone = await db.query(`SELECT 1 FROM entry_comments WHERE id_comment = $1`, [commentId]);
  assert.equal(gone.rowCount, 0, "le commentaire est supprimé");
  await assert.rejects(ReportService.resolve(admin, open.rows[0].id_report, "dismiss"), /déjà traité/);
  assert.equal((await audit("report.resolve")).length, 1);
});
