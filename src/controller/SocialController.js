"use strict";

import SocialService from "../services/SocialService.js";
import ListService from "../services/ListService.js";

const viewer = (req) => req.session?.userId ?? null;
const base = (res) => ({ user: res.locals.currentUser || null, flash: res.locals.flash || {} });
const page = (req) => Math.min(Math.max(Number.parseInt(req.query.page, 10) || 1, 1), 10000);
const enc = encodeURIComponent;

class SocialController {
  async profile(req, res) {
    const data = await SocialService.getPublicProfile(req.params.pseudo, viewer(req), page(req));
    return res.render("pages/social/profile", {
      title: `${data.profile.pseudo} - GamingBox`,
      og: {
        title: `${data.profile.pseudo} sur GamingBox`,
        description: `${data.profile.publicReviews} reviews publiques`,
        image: null,
      },
      ...data,
      page: page(req),
      isSelf: data.profile.id === viewer(req),
      ...base(res),
    });
  }

  async review(req, res) {
    const review = await SocialService.getPublicReview(
      req.params.pseudo,
      req.params.slug,
      viewer(req),
    );
    return res.render("pages/social/review", {
      title: `${review.reviewTitle} - ${review.authorPseudo}`,
      og: {
        title: review.reviewTitle,
        description: `${review.gameTitle} : ${review.reviewRate}/10`,
        image: review.thumbnailUrl,
      },
      review,
      ...base(res),
    });
  }

  async list(req, res) {
    const data = await ListService.getPublic(req.params.pseudo, req.params.slug);
    return res.render("pages/lists/public", {
      title: `${data.list.title} - GamingBox`,
      ...data,
      ...base(res),
    });
  }

  async follow(req, res) {
    await SocialService.follow(viewer(req), req.params.pseudo);
    return res.redirect(`/u/${enc(req.params.pseudo)}`);
  }

  async unfollow(req, res) {
    await SocialService.unfollow(viewer(req), req.params.pseudo);
    return res.redirect(`/u/${enc(req.params.pseudo)}`);
  }

  async like(req, res) {
    await SocialService.toggleLike(viewer(req), req.params.pseudo, req.params.slug);
    return res.redirect(`/u/${enc(req.params.pseudo)}/reviews/${enc(req.params.slug)}`);
  }

  async feed(req, res) {
    const result = await SocialService.feed(viewer(req), page(req));
    return res.render("pages/social/feed", {
      title: "Mon fil - GamingBox",
      reviews: result.items,
      total: result.total,
      page: page(req),
      ...base(res),
    });
  }
}

export default new SocialController();
