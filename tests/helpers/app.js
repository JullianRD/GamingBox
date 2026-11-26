// Utilitaires de test d'intégration : application Express + base PostgreSQL de test.
import supertest from "supertest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= process.env.TEST_DATABASE_URL;
process.env.SESSION_SECRET ||= "test-session-secret-0123456789abcdef0123";
process.env.CSRF_SECRET ||= "test-csrf-secret-0123456789abcdef01234";

const { createApp } = await import("../../src/app.js");
const { pool } = await import("../../src/config/database.js");
const { default: MailService } = await import("../../src/services/MailService.js");

export { pool, MailService };

export const app = createApp();

/** Extrait le jeton CSRF d'une page HTML rendue. */
export const extractCsrf = (html) => {
  const match = /name="_csrf" value="([^"]+)"/.exec(html);
  if (!match) throw new Error("Jeton CSRF introuvable dans la page");
  return match[1];
};

/**
 * Client HTTP avec cookies (session + CSRF) :
 *   const client = newClient();
 *   await client.post("/login", { email, password }, "/login");  // récupère un jeton sur /login
 */
export function newClient() {
  const agent = supertest.agent(app);

  return {
    agent,
    get: (url) => agent.get(url),
    async csrf(fromPage = "/login") {
      const res = await agent.get(fromPage);
      return extractCsrf(res.text);
    },
    /** POST de formulaire avec jeton CSRF valide (récupéré sur `fromPage`). */
    async post(url, body = {}, fromPage = "/login") {
      const token = await this.csrf(fromPage);
      return agent.post(url).type("form").send({ ...body, _csrf: token });
    },
  };
}

let counter = 0;
export const uniqueUser = (prefix = "user") => {
  counter += 1;
  const id = `${prefix}${Date.now().toString(36)}${counter}`;
  return { pseudo: id, email: `${id}@example.test`, password: "Sup3r-secret-pass" };
};

/** Crée un compte vérifié et connecte le client. */
export async function registerAndLogin(client, overrides = {}, { verified = true } = {}) {
  const user = { ...uniqueUser(), ...overrides };
  await client.post(
    "/register",
    { pseudo: user.pseudo, email: user.email, password: user.password, gdprConsent: "on" },
    "/register",
  );

  if (verified) {
    await pool.query("UPDATE users SET email_verified_at = now() WHERE email = $1", [user.email]);
  }

  const res = await client.post("/login", { email: user.email, password: user.password }, "/login");
  const { rows } = await pool.query("SELECT id_user FROM users WHERE email = $1", [user.email]);
  return { ...user, id: rows[0].id_user, loginResponse: res };
}

/** Insère un jeu directement en base. */
export async function createGame(overrides = {}) {
  const n = Math.floor(Math.random() * 1e9);
  const { rows } = await pool.query(
    `INSERT INTO games (igdb_id, game_title, game_genre, release_date, thumbnail_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_game`,
    [overrides.igdbId ?? n, overrides.title ?? `Jeu ${n}`, overrides.genre ?? "RPG", "2020-01-01", "https://images.igdb.com/x.jpg"],
  );
  return rows[0].id_game;
}
