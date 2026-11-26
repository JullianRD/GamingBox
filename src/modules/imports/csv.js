"use strict";

/**
 * CSV au sens RFC 4180 : champs entre guillemets, guillemets doublés,
 * retours à la ligne dans un champ. Séparateur détecté (« , » ou « ; »).
 */
export const parseCsv = (input) => {
  const text = String(input).replace(/^﻿/, "");
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
};

// Lignes vers objets, avec les en-têtes de la première ligne
export const parseCsvObjects = (input) => {
  const [header = [], ...rows] = parseCsv(input);
  const keys = header.map((h) => h.trim());
  return rows.map((cells) => Object.fromEntries(keys.map((key, index) => [key, (cells[index] ?? "").trim()])));
};

const escape = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (headers, rows) =>
  [headers, ...rows.map((row) => headers.map((h) => row[h]))].map((cells) => cells.map(escape).join(",")).join("\r\n") + "\r\n";
