import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../src/utils/AppError.js";

test("une erreur 4xx est marquée fail et opérationnelle", () => {
  const error = new AppError("Review introuvable", 404);
  assert.equal(error.statusCode, 404);
  assert.equal(error.status, "fail");
  assert.equal(error.isOperational, true);
  assert.ok(error instanceof Error);
});

test("une erreur 5xx est marquée error", () => {
  assert.equal(new AppError("Panne", 500).status, "error");
});
