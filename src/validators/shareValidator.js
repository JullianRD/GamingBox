"use strict";

import { z } from "zod";

/**
 * Validation des partages
 *
 * @see https://zod.dev
 */

const recipientEmail = z.email("Email du destinataire invalide");

export const schemas = {
  createProfile: z.object({
    recipientEmail,
  }),

  createReview: z.object({
    reviewId: z.uuid("Identifiant de review invalide"),
    recipientEmail,
  }),
};