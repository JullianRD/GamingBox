/* Comportements globaux, sans handler inline (compatible avec la CSP : script-src-attr 'none'). */
(() => {
  "use strict";

  // Confirmation avant action destructrice : <form data-confirm="..."> ou <button data-confirm="...">
  document.addEventListener("submit", (event) => {
    const message = event.target.dataset?.confirm;
    if (message && !window.confirm(message)) event.preventDefault();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("button[data-confirm], a[data-confirm]");
    if (button && !window.confirm(button.dataset.confirm)) event.preventDefault();
  });

  // <select data-autosubmit> : soumet le formulaire au changement
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el.matches?.("[data-autosubmit]") && el.form) el.form.requestSubmit();
  });

  // PWA : service worker (hors ligne minimal + installation)
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
})();
