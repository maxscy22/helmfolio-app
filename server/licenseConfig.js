// License verification configuration for the local backend.
//
// Must stay in sync with src/lib/licenseConfig.ts. The backend verifies the
// Ed25519-signed JWT on premium routes (requireLicense middleware) so repacking
// the frontend to force-show paid components does nothing — the API still 402s.
//
// NOTE: Must pair with the JWT_PRIVATE_KEY secret on the Cloudflare Worker and
// match src/lib/licenseConfig.ts. Regenerate both copies if you rotate the keypair.
export const LICENSE_PUBLIC_KEY = 'MCowBQYDK2VwAyEA70oKsA3SKL4HzeChSX6Ry7UqRCVLD9yA+LpFQV32dNY=';
