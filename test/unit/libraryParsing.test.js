import { test } from "node:test";
import assert from "node:assert/strict";

process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
const { parseEntryFields, parseTagName } = await import("../../src/modules/library/LibraryService.js");
const { parseListInput } = await import("../../src/modules/lists/ListService.js");

test("parseEntryFields garde seulement les champs envoyés", () => {
  assert.deepEqual(parseEntryFields({ status: "completed" }), { status: "completed" });
  assert.deepEqual(parseEntryFields({}), {});
});

test("parseEntryFields refuse un statut inconnu", () => {
  assert.throws(() => parseEntryFields({ status: "Terminé" }), /Statut inconnu/);
});

test("parseEntryFields accepte une note de 1 à 10 et l'efface si vide", () => {
  assert.deepEqual(parseEntryFields({ rating: "8" }), { rating: 8 });
  assert.deepEqual(parseEntryFields({ rating: "" }), { rating: null });
  assert.throws(() => parseEntryFields({ rating: "11" }), /entre 1 et 10/);
  assert.throws(() => parseEntryFields({ rating: "4.5" }), /entre 1 et 10/);
});

test("parseEntryFields nettoie l'avis et le borne à 5000 caractères", () => {
  assert.deepEqual(parseEntryFields({ review: "  Super  " }), { review: "Super" });
  assert.deepEqual(parseEntryFields({ review: "   " }), { review: null });
  assert.throws(() => parseEntryFields({ review: "a".repeat(5001) }), /5000/);
});

test("parseTagName normalise les espaces et borne la longueur", () => {
  assert.equal(parseTagName("  coup   de cœur "), "coup de cœur");
  assert.throws(() => parseTagName("a"), /entre 2 et 30/);
});

test("parseListInput valide le titre et la catégorie", () => {
  assert.deepEqual(parseListInput({ title: " Mes jeux préférés ", type: "game" }), {
    title: "Mes jeux préférés",
    description: null,
    type: "game",
  });
  assert.throws(() => parseListInput({ title: "x" }), /entre 2 et 100/);
  assert.throws(() => parseListInput({ title: "Ok liste", type: "podcast" }), /Catégorie inconnue/);
});
