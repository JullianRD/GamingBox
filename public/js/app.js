document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("gameId");
  const gamesDataScript = document.getElementById("games-data");

  // Si on n'est pas sur la page review/new → on stop
  if (!select || !gamesDataScript) return;

  let games = [];

  try {
    games = JSON.parse(gamesDataScript.textContent || "[]");
  } catch (error) {
    console.error("Erreur parsing games-data:", error);
    return;
  }

  console.log("GAMES FRONT:", games);

  const titleEl = document.getElementById("gameTitlePreview");
  const genreEl = document.getElementById("gameGenrePreview");
  const releaseEl = document.getElementById("gameReleasePreview");
  const thumbnailEl = document.getElementById("gameThumbnailPreview");
  const fallbackEl = document.getElementById("gameThumbnailFallback");

  function resetPreview() {
    titleEl.textContent = "Aucun jeu sélectionné";
    genreEl.textContent = "—";
    releaseEl.textContent = "—";

    thumbnailEl.src = "";
    thumbnailEl.classList.add("hidden");
    fallbackEl.classList.remove("hidden");
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    if (isNaN(date)) return "—";
    return date.toLocaleDateString("fr-FR");
  }

  function updatePreview() {
    const selectedId = select.value;

    console.log("SELECTED ID:", selectedId);

    const game = games.find(
      (g) => String(g.id_game) === String(selectedId),
    );

    console.log("FOUND GAME:", game);

    if (!game) {
      resetPreview();
      return;
    }

    titleEl.textContent = game.game_title || "Titre inconnu";
    genreEl.textContent = game.game_genre || "—";
    releaseEl.textContent = formatDate(game.release_date);

    if (game.thumbnail_url) {
      thumbnailEl.src = game.thumbnail_url;
      thumbnailEl.classList.remove("hidden");
      fallbackEl.classList.add("hidden");
    } else {
      thumbnailEl.src = "";
      thumbnailEl.classList.add("hidden");
      fallbackEl.classList.remove("hidden");
    }
  }

  select.addEventListener("change", updatePreview);

  // Reset au début
  resetPreview();
});