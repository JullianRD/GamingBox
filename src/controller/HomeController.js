"use strict";

/**
 * HomeController
 *
 * Pages publiques (marketing / info)
 *
 * @see docs/user-stories.md#public-pages
 */
class HomeController {
  /**
   * 🏠 Page d'accueil
   */

  // La page d'accueil principale de l'app elle permet d'accéder au inscription et login et elle contients quelques explications sur Cocon
  async home(req, res) {
    res.render("pages/home", {
      title: "Cocon",
      user: req.session.userId ?? null,
    });
  }

  /**
   * ℹÀ propos
   */
  about(req, res) {
    res.render("pages/about", {
      title: "À propos - Cocon",
    });
  }

  /**
   * Contact
   */
  contact(req, res) {
    res.render("pages/contact", {
      title: "Contact - Cocon",
    });
  }

  /**
   * Documentation
   */
  documentation(req, res) {
    res.render("pages/documentation", {
      title: "Documentation - Cocon",
    });
  }
}

export default new HomeController();
