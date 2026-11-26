import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSlug } from "../../src/utils/generateSlug.js";

test("met en minuscules et remplace les espaces par des tirets", () => {
  assert.equal(generateSlug("Une Claque Narrative"), "une-claque-narrative");
});

test("supprime la ponctuation", () => {
  assert.equal(generateSlug("Elden Ring : 10/10 !"), "elden-ring-1010");
});

test("retire les tirets en début et en fin", () => {
  assert.equal(generateSlug("  - Hades II -  "), "hades-ii");
});

test("retire les accents", () => {
  assert.equal(generateSlug("Mes jeux préférés"), "mes-jeux-preferes");
});
