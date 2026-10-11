import passport from "passport";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import type { Role } from "@complianceos/shared";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import type { UserRow } from "../db/types.js";
import type { JwtPayload } from "./jwt.js";

// The token only names user + org; the role is re-read from Membership on
// every request so removed/suspended members and role changes take effect
// immediately rather than at token expiry.
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwtSecret,
    },
    async (payload: JwtPayload, done) => {
      try {
        const { rows } = await pool.query<UserRow & { memberRole: Role }>(
          `SELECT "User".*, "Membership".role AS "memberRole"
             FROM "User"
             JOIN "Membership" ON "Membership"."userId" = "User".id
            WHERE "User".id = $1
              AND "Membership"."organizationId" = $2
              AND "Membership".status <> 'SUSPENDED'`,
          [payload.userId, payload.organizationId]
        );
        const row = rows[0];
        if (!row) return done(null, false);
        const { memberRole, ...user } = row;
        return done(null, { ...user, organizationId: payload.organizationId, role: memberRole });
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

// Google sign-in is handled by POST /auth/google (authorization-code
// exchange in routes/auth.ts), not a passport strategy.
//
// SAML/OIDC enterprise SSO strategies (Azure AD, Okta, Auth0, custom SAML)
// are registered per-organization in ./sso/ once OrganizationSettings.ssoConfig
// is wired up.

export { passport };
