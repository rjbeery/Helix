import { Request, Response, NextFunction } from "express";
import * as jwtRaw from "jsonwebtoken";
const jwt = (jwtRaw as any).default ?? (jwtRaw as any); // compat shim
import type { JwtPayload } from "jsonwebtoken";
import type { Role } from "../types/auth.js";

export interface AuthedRequest extends Request {
  user?: { sub: string; role: Role };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server misconfigured: missing JWT_SECRET" });
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload | string;
    if (typeof decoded !== "object" || !decoded) {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    const { sub, role } = decoded as { sub?: string; role?: Role };
    if (!sub || (role !== "master" && role !== "guest")) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = { sub, role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
