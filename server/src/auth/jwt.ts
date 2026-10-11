import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config.js";

export interface JwtPayload {
  userId: string;
  organizationId: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, config.jwtSecret, options);
}
