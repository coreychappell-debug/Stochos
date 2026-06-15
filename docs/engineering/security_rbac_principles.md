# Stochos Platform Security & RBAC Principles

This document specifies the authentication, authorization, and data access control architecture implemented on the Stochos Platform.

---

## 1. Authentication Layer (NextAuth v5 / Auth.js)

The platform utilizes **NextAuth.js v5 (beta)** for session management, tracking logins, and verifying authorization credentials.
- **Session Strategy**: JSON Web Token (JWT) based sessions.
- **Encryption**: The session token is stored in the browser as an HTTP-only, secure cookie (`authjs.session-token` or `__Secure-authjs.session-token`). It is encrypted using JWE (JSON Web Encryption) with AES-256-GCM.
- **Token Claims**: Upon successful login, the following claims are injected into the session token:
  - `id`: Unique user UUID.
  - `email`: User's authenticated email.
  - `name`: User's display name.
  - `role`: Mapped role name string (e.g. `admin`, `analyst`, `sales_rep`, `procurement_officer`, `marketing_manager`, `it_manager`, `manager`).
  - `permissions`: JSON key-value permissions map associated with the role.
  - `jurisdictionId`: Mapped regional jurisdiction UUID (e.g., NY Lottery).

---

## 2. Section-Level Role-Based Access Control (RBAC)

Routing security is enforced globally inside [middleware.js](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/middleware.js) running in the Next.js Edge Runtime. 

### 2.1 Decryption in Edge Runtime
Because heavy database drivers (like Prisma Client) cannot be loaded inside the Edge Runtime due to native dependency boundaries, the middleware utilizes `getToken` from `next-auth/jwt`. This helper decrypts the session cookie using Web Crypto APIs and the `NEXTAUTH_SECRET`/`AUTH_SECRET` environment variables.

### 2.2 Section Allowed Roles Mapping
If a user is authenticated, the middleware evaluates their `role` against the defined Route Access Map:

| Route Prefix | Mapped Section | Allowed Roles |
|---|---|---|
| `/` | Dashboard | All authenticated users |
| `/help` | User Guide & Help Center | All authenticated users |
| `/spatial-ops` | SOLR Spatial Maps | `admin`, `analyst`, `manager` |
| `/analytics/*` | Performance Dashboards | `admin`, `analyst`, `manager` |
| `/reporting/*` | GFPA Financial Suite | `admin`, `procurement_officer`, `analyst` |
| `/fomo/*` | FOMO Field Ops | `admin`, `sales_rep`, `manager` |
| `/fleet/*` | Fleet Tracking | `admin`, `sales_rep`, `manager` |
| `/contracts/*` | Contract Management | `admin`, `procurement_officer` |
| `/vendors/*` | Vendor Registry | `admin`, `procurement_officer` |
| `/marketing/*` | Campaign MRM | `admin`, `marketing_manager` |
| `/instant-tickets/*` | Game Planning | `admin`, `marketing_manager` |
| `/assets/*` | IT Asset Registry | `admin`, `it_manager` |

If a user requests a route prefix and does not possess a role matching the allowed list, they are redirected to `/unauthorized` which displays a standard Access Denied layout.

---

## 3. Data-Level Contract Permissions (Row-Level Security)

In addition to routing gates, data access boundaries are enforced at the API layer for contract operations, protecting sensitive legal and financial documents.

### 3.1 Contract Registry Gate (`GET /api/contracts`)
When querying the contracts database list inside [route.js](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/app/api/contracts/route.js):
- If the session user holds the `admin` role, they are granted unrestricted access to query all contracts.
- Non-admin users are restricted using an `OR` query logic. They can only retrieve contracts where:
  - The contract was created by them: `{ createdById: userId }`
  - They have been explicitly granted sharing access inside the `ContractAccess` table: `{ contractAccess: { some: { userId: userId } } }`

### 3.2 Single Contract Operations (`/api/contracts/[id]`)
Inside [route.js](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/app/api/contracts/%5Bid%5D/route.js):
- **Read Operations (GET)**: Rejects the request with a `403 Access Denied` response if a non-admin attempts to retrieve a contract they did not create or that has not been shared with their account ID.
- **Write Operations (PUT / DELETE)**: Non-admin users must have an entry inside the `ContractAccess` table with the `permission` attribute set to `"write"` to modify or delete a contract. If they only possess `"read"` access, the operation is blocked.
