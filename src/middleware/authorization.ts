import { Request, Response, NextFunction } from "express";

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

export function requireSelfOrRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (
      req.user &&
      (req.user.role === role || req.user._id?.toString() === req.params.id)
    ) {
      return next();
    }
    return res
      .status(403)
      .json({ error: "Forbidden: insufficient permissions" });
  };
}
