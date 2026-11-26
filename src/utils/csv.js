"use strict";

/**
 * Parseur CSV minimal conforme RFC 4180 : guillemets, guillemets doublés, retours
 * à la ligne dans un champ, séparateur `,` ou `;` (détecté sur la première ligne).
 *
 * @param {string} text
 * @returns {Array<Record<string, string>>} lignes sous forme d'objets (clés en minuscules)
 */
export function parseCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
    .map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()])),
    );
}

/** Neutralise l'injection de formules à l'ouverture d'un export CSV dans un tableur. */
export function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
