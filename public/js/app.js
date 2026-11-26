// Cocon : petits comportements globaux côté client
document.addEventListener("htmx:beforeRequest", () => {
  // Une nouvelle action efface le message d'erreur précédent de la fiche
  const error = document.getElementById("entry-error");
  if (error) error.textContent = "";
});

// Duels « Tu préfères » : flèche gauche ou droite pour choisir
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea, select") || event.altKey || event.ctrlKey || event.metaKey) return;
  const pick = { ArrowLeft: "0", ArrowRight: "1" }[event.key];
  const button = pick && document.querySelector(`#duel [data-duel-pick="${pick}"]`);
  if (button) {
    event.preventDefault();
    button.click();
  }
});
