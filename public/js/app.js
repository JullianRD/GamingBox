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

// Carrousels de l'accueil : les onglets font défiler les panneaux, le défilement met à jour l'onglet
const initCarousel = (root) => {
  const track = root.querySelector("[data-carousel-track]");
  const tabs = [...root.querySelectorAll("[data-carousel-tab]")];
  if (!track || root.dataset.carouselReady) return;
  root.dataset.carouselReady = "1";
  const select = (index) => tabs.forEach((tab, i) => tab.setAttribute("aria-selected", String(i === index)));
  tabs.forEach((tab, i) =>
    tab.addEventListener("click", () => {
      const slide = track.children[i];
      if (slide) track.scrollTo({ left: slide.offsetLeft - track.firstElementChild.offsetLeft, behavior: "smooth" });
      select(i);
    }),
  );
  let frame;
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const width = track.firstElementChild?.offsetWidth || 1;
      select(Math.round(track.scrollLeft / (width + 12)));
    });
  });
};
const initCarousels = (scope = document) => scope.querySelectorAll("[data-carousel]").forEach(initCarousel);
document.addEventListener("DOMContentLoaded", () => initCarousels());
document.addEventListener("htmx:afterSettle", (event) => initCarousels(event.target));
