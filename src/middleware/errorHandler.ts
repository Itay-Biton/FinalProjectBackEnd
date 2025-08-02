import { Request, Response, NextFunction } from "express";

export const errorHandler = (err: any, req: any, res: any, next: any) => {
  console.error(err);

  if (err.name === "FirebaseAuthError") {
    return res.status(401).json({ error: "Invalid Firebase token" });
  }

  res.status(500).json({ error: "Internal server error" });
};
