"use strict";
/**
 * Envoi d'emails transactionnels (SMTP via nodemailer).
 * Sans SMTP_HOST, les messages sont journalisés (dev) et, en test, conservés
 * dans `MailService.outbox` pour être inspectés par les tests.
 */
import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import logger from "../config/logger.js";

let transporter = null;

function getTransporter() {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

const baseUrl = () => env.APP_FRONTEND_URL.replace(/\/$/, "");

class MailService {
  /** Boîte d'envoi en mémoire (tests uniquement). */
  static outbox = [];

  static url(pathname) {
    return `${baseUrl()}${pathname}`;
  }

  static async send({ to, subject, text }) {
    const message = { from: env.MAIL_FROM, to, subject, text };

    if (env.isTest) {
      this.outbox.push(message);
      return;
    }

    const smtp = getTransporter();
    if (!smtp) {
      logger.info({ to, subject, text }, "Email (SMTP non configuré, non envoyé)");
      return;
    }

    try {
      await smtp.sendMail(message);
    } catch (err) {
      // L'échec d'un email ne doit pas faire échouer l'action de l'utilisateur
      logger.error({ err, to, subject }, "Échec d'envoi d'email");
    }
  }

  static sendVerification(user, token) {
    return this.send({
      to: user.email,
      subject: "Confirme ton adresse email - GamingBox",
      text: `Bienvenue ${user.pseudo} !\n\nConfirme ton adresse email (lien valable 24 h) :\n${this.url(`/verify-email/${token}`)}\n\nSi tu n'es pas à l'origine de cette inscription, ignore ce message.`,
    });
  }

  static sendPasswordReset(user, token) {
    return this.send({
      to: user.email,
      subject: "Réinitialisation de ton mot de passe - GamingBox",
      text: `Pour choisir un nouveau mot de passe (lien valable 1 h) :\n${this.url(`/reset-password/${token}`)}\n\nSi tu n'as rien demandé, ignore ce message : ton mot de passe reste inchangé.`,
    });
  }

  static sendShareInvitation({ to, ownerPseudo, kind, token }) {
    return this.send({
      to,
      subject: `${ownerPseudo} a partagé ${kind === "review" ? "une review" : "son profil"} avec toi - GamingBox`,
      text: `${ownerPseudo} te partage ${kind === "review" ? "une review" : "son profil"} sur GamingBox :\n${this.url(`/shares/access/${token}`)}`,
    });
  }
}

export default MailService;
