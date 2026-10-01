import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

export function getVerifiedUserId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!getVerifiedUserId(req)) {
    res.status(401).json({ error: "Sign-in is required." });
    return;
  }

  next();
};