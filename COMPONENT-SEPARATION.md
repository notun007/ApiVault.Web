# Component Separation

The ApiVault.Web frontend has been reorganized so every Angular component uses separate files:

- `*.component.ts` for TypeScript logic and component metadata
- `*.component.html` for the Angular template
- `*.component.scss` for component-local styles

The shared ApiVault design system remains in `src/styles.scss`. This preserves the exact layout and behavior of the previously generated port-44315 project while allowing future styles to be added locally to each component.

## Preserved configuration

- API base URL: `https://localhost:44315`
- Angular development proxy: `proxy.conf.json`
- Runtime configuration: `public/config/runtime-config.json`
- Authentication, guards, interceptors, routes, forms, API clients, role checks, CRUD operations, testing console, history, and administration behavior

## Validation performed

- 21 component TypeScript files detected
- 21 external HTML templates generated
- 21 external SCSS files generated
- No `template:` or `styles:` metadata remains in component TypeScript files
- Component class logic compared with the original project and confirmed unchanged
- JSON configuration files parsed successfully
- Old port `7185` is not present
