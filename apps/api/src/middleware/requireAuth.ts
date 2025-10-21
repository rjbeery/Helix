import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

export interface AuthedRequest extends Request {
  user?: { sub: string; role: "master" | "fnbo" };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Server misconfigured: missing JWT_SECRET" });
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload | string;

    if (typeof decoded !== "object" || !decoded || !("sub" in decoded) || !("role" in decoded)) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = { sub: decoded.sub as string, role: decoded.role as "master" | "fnbo" };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
