"use strict";

import AdminService from "../services/AdminService.js";

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const TABS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/items", label: "Catalogue" },
  { href: "/admin/comments", label: "Commentaires" },
];

const render = (res, view, title, locals) =>
  res.render(`pages/admin/${view}`, { title: `${title} - Admin Cocon`, adminTabs: TABS, ...locals });

class AdminController {
  index = wrap(async (req, res) => render(res, "index", "Vue d'ensemble", await AdminService.getDashboard()));
  users = wrap(async (req, res) =>
    render(res, "users", "Utilisateurs", { users: await AdminService.getUsers() }),
  );
  items = wrap(async (req, res) =>
    render(res, "items", "Catalogue", { items: await AdminService.getItems() }),
  );
  comments = wrap(async (req, res) =>
    render(res, "comments", "Commentaires", { comments: await AdminService.getComments() }),
  );

  destroyUser = wrap(async (req, res) => {
    const deleted = await AdminService.deleteUser(req.params.id, req.session.userId);
    req.flash(deleted ? "success" : "error", deleted ? "Utilisateur supprimé." : "Suppression impossible.");
    res.redirect("/admin/users");
  });

  destroyItem = wrap(async (req, res) => {
    await AdminService.deleteItem(req.params.id);
    req.flash("success", "Œuvre retirée du catalogue.");
    res.redirect("/admin/items");
  });

  destroyComment = wrap(async (req, res) => {
    await AdminService.deleteComment(req.params.id);
    req.flash("success", "Commentaire supprimé.");
    res.redirect("/admin/comments");
  });
}

export default new AdminController();
