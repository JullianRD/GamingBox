import { test } from "node:test";
import assert from "node:assert/strict";
import { schemas } from "../../src/validators/tagValidator.js";

test("accepte un tag valide et le nettoie", () => {
  assert.equal(schemas.create.parse({ tagName: "  RPG  " }).tagName, "RPG");
});

test("refuse un tag trop court ou trop long", () => {
  assert.equal(schemas.create.safeParse({ tagName: "a" }).success, false);
  assert.equal(schemas.create.safeParse({ tagName: "x".repeat(31) }).success, false);
});

test("la mise à jour accepte un objet partiel", () => {
  assert.equal(schemas.update.safeParse({}).success, true);
});
