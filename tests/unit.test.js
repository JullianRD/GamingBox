import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.NODE_ENV = "test";

const { safeRedirect } = await import("../src/utils/safeRedirect.js");
const { generateSlug } = await import("../src/utils/generateSlug.js");
const { isPasswordPwned } = await import("../src/utils/passwordPolicy.js");
const { normalizeError } = await import("../src/middlewares/errorMiddleware.js");
const { AppError } = await import("../src/utils/AppError.js");
const { normalizeAccessConfig } = await import("../src/services/ShareService.js");
const { normalizeStatus, normalizePlatform, normalizeRating } =
  await import("../src/services/ImportService.js");
const { hashPassword, verifyPassword } = await import("../src/utils/passwordHelper.js");

test("safeRedirect n'accepte que des chemins internes", () => {
  assert.equal(safeRedirect("/reviews?tag=1", "/"), "/reviews?tag=1");
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/ok\r\nSet-Cookie: x=1",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(safeRedirect(bad, "/fallback"), "/fallback", String(bad));
  }
});

test("generateSlug : accents, ponctuation, tirets en bordure, titres non latins", () => {
  assert.equal(generateSlug("Pokémon : Édition Rouge !"), "pokemon-edition-rouge");
  assert.equal(generateSlug("  --Zelda__BotW--  "), "zelda-botw");
  assert.equal(generateSlug("ファイナルファンタジー"), "");
  assert.equal(generateSlug(null), "");
});

test("HIBP : détecte un hash présent, ignore l'absence, passe en fail-open sur erreur réseau", async () => {
  const password = "password123";
  const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const reply =
    (text, ok = true) =>
    async () => ({ ok, text: async () => text });

  assert.equal(
    await isPasswordPwned(password, { fetchImpl: reply(`ABCDEF:3\n${sha1.slice(5)}:42\n`) }),
    true,
  );
  assert.equal(
    await isPasswordPwned(password, { fetchImpl: reply(`${sha1.slice(5)}:0\nZZZ:5\n`) }),
    false,
    "padding à 0",
  );
  assert.equal(await isPasswordPwned(password, { fetchImpl: reply("", false) }), false);
  assert.equal(
    await isPasswordPwned(password, {
      fetchImpl: async () => {
        throw new Error("réseau");
      },
    }),
    false,
  );

  let requestedUrl;
  await isPasswordPwned(password, {
    fetchImpl: async (url) => {
      requestedUrl = url;
      return { ok: true, text: async () => "" };
    },
  });
  assert.equal(
    requestedUrl,
    `https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`,
    "seul le préfixe de 5 caractères est envoyé",
  );
});

test("normalizeError : statuts et messages exposables", () => {
  assert.deepEqual(normalizeError(AppError.notFound("X")), {
    status: 404,
    message: "X",
    expose: true,
  });
  assert.equal(normalizeError({ code: "EBADCSRFTOKEN" }).status, 403);
  assert.equal(normalizeError({ code: "22P02" }).status, 404);
  assert.equal(normalizeError({ name: "MulterError", code: "LIMIT_FILE_SIZE" }).status, 413);
  const unexpected = normalizeError(new Error("SELECT * FROM secrets"));
  assert.equal(unexpected.status, 500);
  assert.doesNotMatch(unexpected.message, /SELECT/);
});

test("normalizeAccessConfig : expiration future et limite de vues bornées", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(
    normalizeAccessConfig({ expiration: future, maxViews: "5", allow_download: "on" }).maxViews,
    5,
  );
  assert.deepEqual(normalizeAccessConfig({}), {
    allow_download: false,
    expiration: null,
    maxViews: null,
  });
  for (const bad of [
    { expiration: "2000-01-01" },
    { expiration: "pas une date" },
    { maxViews: "0" },
    { maxViews: "1.5" },
    { maxViews: "99999" },
  ]) {
    assert.throws(
      () => normalizeAccessConfig(bad),
      (e) => e.statusCode === 400,
      JSON.stringify(bad),
    );
  }
});

test("import : normalisation des statuts, plateformes et notes", () => {
  assert.equal(normalizeStatus("Terminé"), "Terminé");
  assert.equal(normalizeStatus("Finished"), "Terminé");
  assert.equal(normalizeStatus("wishlist"), "Whislist");
  assert.equal(normalizeStatus("Abandonné"), "Dropped");
  assert.equal(normalizeStatus("playing"), "En cour");
  assert.equal(normalizePlatform("PlayStation 5"), "Console de jeu");
  assert.equal(normalizePlatform("Steam"), "PC");
  assert.equal(normalizePlatform("???"), "Autre");
  assert.equal(normalizeRating("8,5"), 8.5);
  assert.equal(normalizeRating("15"), 10);
  assert.equal(normalizeRating("abc"), 0);
});

test("Argon2id : hash vérifiable ; hash corrompu => false sans exception", async () => {
  const hash = await hashPassword("secret-pass");
  assert.ok(hash.startsWith("$argon2id$"));
  assert.equal(await verifyPassword(hash, "secret-pass"), true);
  assert.equal(await verifyPassword(hash, "autre"), false);
  assert.equal(await verifyPassword("pas-un-hash", "secret-pass"), false);
});
