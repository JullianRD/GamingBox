"use strict";

import { statusLabel } from "../../utils/itemTypes.js";

const STATUS_VERBS = {
  planned: "veut découvrir",
  in_progress: "a commencé",
  completed: "a terminé",
  paused: "a mis en pause",
  dropped: "a abandonné",
};

// Phrase d'une activité du fil : verbe + complément (l'œuvre est affichée à part)
export const describeActivity = (activity) => {
  const { kind, payload = {}, item, list, target } = activity;
  switch (kind) {
    case "added":
      return {
        verb: "a ajouté",
        detail: item ? `(${statusLabel(item.type, payload.status).toLowerCase()})` : "",
      };
    case "status":
      return { verb: STATUS_VERBS[payload.status] ?? "a mis à jour", detail: "" };
    case "rated":
      return { verb: "a noté", detail: payload.rating ? `${payload.rating / 2}/5` : "" };
    case "reviewed":
      return { verb: "a donné son avis sur", detail: "", quote: payload.excerpt ?? null };
    case "favorited":
      return { verb: "a mis en favori", detail: "" };
    case "listed":
      return { verb: "a ajouté", detail: list ? `à la liste « ${list.title} »` : "à une liste" };
    case "commented":
      return { verb: "a commenté", detail: target ? `l'entrée de ${target.pseudo}` : "" };
    case "recommended":
      return { verb: "a recommandé", detail: target ? `à ${target.pseudo}` : "" };
    case "followed":
      return { verb: "suit maintenant", detail: target ? target.pseudo : "" };
    default:
      return { verb: "", detail: "" };
  }
};
