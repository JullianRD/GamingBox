"use strict";

import { shuffle } from "./bracket.js";

/**
 * Questions à choix multiples du blindtest : une bonne réponse, trois leurres
 * différents pris dans la même famille quand c'est possible.
 */

export const QUESTIONS = 10;

export const makeQuestion = (answer, distractors, random = Math.random) => {
  const others = shuffle(
    [...new Set(distractors.map((d) => d.label))].filter((label) => label !== answer.label),
    random,
  ).slice(0, 3);
  if (others.length < 3) return null;
  const options = shuffle([answer.label, ...others], random);
  return { prompt: answer.prompt, media: answer.media, options, answer: options.indexOf(answer.label), reveal: answer.reveal ?? answer.label };
};

// pool : [{ label, prompt, media, reveal? }] ; chaque élément peut servir de leurre aux autres
export const buildQuiz = (pool, { count = QUESTIONS, random = Math.random } = {}) => {
  const questions = [];
  const used = new Set();
  for (const answer of shuffle(pool, random)) {
    if (questions.length >= count) break;
    if (used.has(answer.label)) continue;
    const question = makeQuestion(answer, pool, random);
    if (question) {
      used.add(answer.label);
      questions.push(question);
    }
  }
  return questions;
};

// Question envoyée au navigateur : sans la bonne réponse
export const publicQuestion = (question) => ({ prompt: question.prompt, media: question.media, options: question.options });
