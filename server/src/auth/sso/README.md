# Enterprise SSO strategies

> Not implemented yet - the schema (`OrganizationSettings`) and Settings UI are ready; the adapters below are the next step.

Placeholder for per-organization SAML/OIDC strategy adapters (Azure AD, Okta,
Auth0, custom SAML), driven by `OrganizationSettings.ssoProvider` /
`ssoConfig` in the schema. Each provider gets its own file here
(`azureAd.ts`, `okta.ts`, `auth0.ts`, `customSaml.ts`) exporting a
passport strategy configured from the org's stored `ssoConfig`, registered
dynamically per-request/per-org rather than globally at boot.
