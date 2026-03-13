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

  // La page d'accueil principale de l'app elle permet d'accéder au inscription et login et elle contients quelques explications sur GamingBox
  async home(req, res) {
    res.render("pages/home", {
      title: "Gamingbox",
      user: req.session.userId ?? null,
    });
  }

  /**
   * ℹÀ propos
   */
  about(req, res) {
    res.render("pages/about", {
      title: "À propos - GamingBox",
    });
  }

  /**
   * Contact
   */
  contact(req, res) {
    res.render("pages/contact", {
      title: "Contact - GamingBox",
    });
  }

  /**
   * Documentation
   */
  documentation(req, res) {
    res.render("pages/documentation", {
      title: "Documentation - GamingBox",
    });
  }
}

export default new HomeController();
