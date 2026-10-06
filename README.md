# ApiVault.Web

Responsive Angular frontend for the `ApiVault.Api` banking API repository and governance backend.

## Technology

- Angular 22 standalone application
- Angular signals and zoneless change detection
- Reactive Forms
- One source setting for the API URL
- Self-hosted Scalar API Reference package
- No external UI framework or icon dependency
- Nginx and IIS SPA deployment samples

Angular 22 requires Node.js `^22.22.3`, `^24.15.0`, or `^26.0.0` and TypeScript `>=6.0.0 <6.1.0`. The included `.nvmrc` selects Node 24.15.0.

## Implemented screens

- Secure JWT login
- Role-filtered responsive workspace
- Portfolio dashboard
- API catalog search, filters, paging, and lifecycle summaries
- Internal and third-party API registration and editing
- REST, SOAP, and Web Service classification
- Unified source-system and consumer-application registry
- API creator, publishing system, business area, team, vendor company, and external reference
- Vendor-company administration for third-party systems
- Self-service password change and administrator/Super Administrator password reset
- Multiple releases and current-version selection
- Draft, Active, Deprecated, and Retired lifecycle management
- Authentication guidance and JSON configuration
- Request/response byte limits and timeout settings
- Endpoint contract registration and editing
- Development, UAT, Production, DR, and Sandbox environments
- Write-only encrypted environment secret management
- Embedded Scalar reference for every exact API version
- Project/application registration
- Exact project-to-API-version dependency linking
- Controlled API test console
- Request path, query, header, body, and timeout override editing
- Response status, headers, body, duration, request size, and response size
- Retained test history and detailed redacted evidence
- Business area and development team administration
- User creation and role assignment
- Audit log filtering and change inspection

## Backend endpoint coverage

The frontend calls every controller route included in the generated backend:

```text
POST   /api/auth/login
PUT    /api/auth/password
GET    /api/apis
GET    /api/apis/{id}
POST   /api/apis
PUT    /api/apis/{id}
POST   /api/apis/{apiId}/versions
GET    /api/apis/versions/{versionId}
PUT    /api/apis/{apiId}/versions/{versionId}
PATCH  /api/apis/{apiId}/versions/{versionId}/lifecycle
POST   /api/apis/{apiId}/versions/{versionId}/endpoints
PUT    /api/apis/{apiId}/versions/{versionId}/endpoints/{endpointId}
POST   /api/apis/{apiId}/versions/{versionId}/environments
PUT    /api/apis/{apiId}/versions/{versionId}/environments/{environmentId}
PUT    /api/apis/{apiId}/versions/{versionId}/environments/{environmentId}/secret
GET    /api/catalog-documents/{apiVersionId}/openapi.json
GET    /api/projects
GET    /api/projects/{id}
POST   /api/projects
PUT    /api/projects/{id}
POST   /api/projects/{projectId}/api-versions
GET    /api/vendors
POST   /api/vendors
PUT    /api/vendors/{id}
POST   /api/api-tests/execute
GET    /api/api-tests/history
GET    /api/reference-data/business-areas
GET    /api/reference-data/development-teams
POST   /api/reference-data/business-areas
POST   /api/reference-data/development-teams
GET    /api/users
POST   /api/users
PUT    /api/users/{userId}/password
GET    /api/audit-logs
```

## 1. Set the API URL

Edit `apiBaseUrl` in `src/app/core/config/app-config.service.ts` before
building. Use the HTTPS URL that users' browsers can reach:

```ts
apiBaseUrl: 'https://api.example.bank',
```

This is the only Web setting needed for the API address. The same value is
included in both the IIS files and Docker image when you build. Changing it
later requires a new Web build.

## 2. Configure ApiVault.Api CORS

If Web and API use different origins, allow the exact Web origin in
`ApiVault.Api/appsettings.json`:

```json
{
  "Cors": {
    "Origins": [
      "https://web.example.bank"
    ]
  }
}
```

Do not use wildcard origins for this authenticated application.

## 3. Install and run

```bash
npm install
npm start
```

Open:

```text
http://localhost:4200
```

Local development also uses the API URL in `app-config.service.ts`.

## 4. Build

```bash
npm run build:production
```

Output:

```text
dist/ApiVault.Web/browser
```

## 5. Docker

```bash
docker build -t apivault-web .
docker run --rm -p 8080:8080 apivault-web
```

Set `apiBaseUrl` before `docker build`; the image includes that URL.

## 6. IIS

Build the Angular application and copy the contents of
`dist/ApiVault.Web/browser` to the IIS website physical path. The included
`web.config` uses built-in IIS features and does not require the optional
URL Rewrite module. No post-publish configuration script is needed.

## Authentication storage

The backend currently provides an access token without a refresh-token endpoint. ApiVault.Web stores the active login in `sessionStorage`, which is cleared when the browser tab session ends. The frontend automatically removes expired sessions and redirects on HTTP 401.

For a bank production rollout, recommended future backend enhancements include:

- Integration with the bank identity provider using OIDC/OAuth2
- Short-lived access tokens and secure refresh-token rotation
- Multi-factor authentication
- Account disable/update endpoints
- Server-side session revocation

## Scalar behavior

ApiVault.Web first retrieves the generated OpenAPI document with the authenticated Angular `HttpClient`, then passes the in-memory document to the self-hosted `@scalar/api-reference` package. The embedded Scalar test button is disabled so governed test execution remains in ApiVault’s controlled Test Console.

## Security notes

- Frontend validation is usability support only; ApiVault.Api remains the security boundary.
- Secrets are write-only in the UI and are never cached by the frontend.
- The UI explains SSRF, redirect, size, timeout, and redaction controls, but all enforcement is performed by the backend.
- Production should use HTTPS, strict origin CORS, bank-approved CSP, an egress firewall/proxy, and monitored access logs.
- Review the included Nginx CSP before deployment. Scalar or future plugins may require a more tailored policy.


## Component file organization

Every Angular component now uses separate files:

```text
feature.component.ts
feature.component.html
feature.component.scss
```

The TypeScript files contain component logic only. Templates are stored in HTML files, and each component has its own SCSS file. The existing shared design system remains in `src/styles.scss` to preserve the original UI and behavior exactly.
