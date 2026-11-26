// Cocon : petits comportements globaux côté client
document.addEventListener("htmx:beforeRequest", () => {
  // Une nouvelle action efface le message d'erreur précédent de la fiche
  const error = document.getElementById("entry-error");
  if (error) error.textContent = "";
});
