// Run: node scripts/catalog-permissions-smoke.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../src/app/core/services/catalog-permissions.service.ts'), 'utf8');
const exportsObject = {};
new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(id => {
  if (id === '@angular/core') return { Injectable: () => value => value };
  if (id.endsWith('catalog-access.models')) return { ALL_RELEASES: '00000000-0000-0000-0000-000000000000' };
  if (id.endsWith('security.models')) return { UserRole: { Admin: 'Admin', ApiOwner: 'ApiOwner', Tester: 'Tester' } };
  return {};
}, exportsObject);
const prototype = exportsObject.CatalogPermissionsService.prototype;
let role = 'ApiOwner';
let profiles = [];
let grants = [{ applicationId: 'app', apiId: 'api', versionId: 'version', endpointId: 'endpoint', environmentId: 'environment', canCreate: false, canEdit: false }];
const permissions = Object.assign(Object.create(prototype), { auth: { hasAnyRole: (...roles) => roles.includes(role) }, state: () => ({ isUnrestricted: false, grants, profiles }) });
assert.equal(permissions.canRegisterApi(), false);
assert.equal(permissions.canCreate('api'), false);
assert.equal(permissions.canEdit('api'), false);
assert.equal(permissions.canExecute('endpoint', 'environment', 'GET'), true);
for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(permissions.canExecute('endpoint', 'environment', method), false);
grants[0].canCreate = true;
assert.equal(permissions.canRegisterApi('app'), true);
assert.equal(permissions.canRegisterApi('other'), false);
assert.equal(permissions.canCreate('api', 'version'), true);
assert.equal(permissions.canCreate('other'), false);
assert.equal(permissions.canEdit('api'), false);
assert.equal(permissions.canExecute('endpoint', 'environment', 'POST'), true);
grants[0].canEdit = true;
assert.equal(permissions.canEdit('api', 'version', 'endpoint', 'environment'), true);
assert.equal(permissions.canEdit('api', 'version', 'other'), false);
assert.equal(permissions.canEdit('api', 'version', undefined, 'other'), false);
assert.equal(permissions.canExecute('endpoint', 'other', 'POST'), false);
role = 'Tester';
assert.equal(permissions.canCreate('api'), false);
assert.equal(permissions.canEdit('api'), false);
assert.equal(permissions.canExecute('endpoint', 'environment', 'POST'), true);
grants = []; role = 'ApiOwner';
assert.equal(permissions.canEdit('api'), false);
role = 'Admin';
assert.equal(permissions.canEdit('api'), true);
assert.equal(permissions.canRegisterApi(), true);
console.log('PASS: Read-only controls, Create/Edit separation, resource scopes, Tester role limits, missing grants, and Admin override.');

// Exercise the actual Test Console handler as well as the permission service.
const consoleSource = fs.readFileSync(path.resolve(__dirname, '../src/app/features/testing/test-console.component.ts'), 'utf8');
const consoleExports = {};
new Function('require', 'exports', ts.transpileModule(consoleSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(id => {
  if (id === '@angular/core') return { Component: () => value => value };
  return {};
}, consoleExports);
const testConsolePrototype = consoleExports.TestConsoleComponent.prototype;
const fakeSignal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; return read; };
let consoleChecks = 0;
for (const testRole of ['Tester', 'ApiOwner']) {
  role = testRole;
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    grants = [{ applicationId: 'app', apiId: 'api', versionId: 'version', endpointId: 'endpoint', environmentId: 'environment', canCreate: false, canEdit: false }];
    let calls = 0;
    const subject = Object.assign(Object.create(testConsolePrototype), {
      catalogPermissions: permissions,
      selectedEndpointId: () => 'endpoint', selectedEnvironmentId: () => 'environment',
      selectedEndpoint: () => ({ httpMethod: method }), selectedEnvironment: () => ({ isEnabled: true }),
      executing: fakeSignal(false), result: fakeSignal('existing result'), executionError: fakeSignal(''),
      pathRows: [], queryRows: [], headerRows: [], body: '', timeoutSeconds: null,
      testClient: { execute: () => { calls++; return { subscribe: () => {} }; } }
    });
    const expected = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    assert.equal(subject.canExecute(), expected, `${testRole} Read-only ${method} button`);
    subject.execute();
    assert.equal(calls, expected ? 1 : 0, `${testRole} Read-only ${method} must not send a blocked request`);
    if (!expected) {
      assert.equal(subject.executing(), false);
      assert.equal(subject.result(), 'existing result');
      grants[0][method === 'POST' ? 'canCreate' : 'canEdit'] = true;
      assert.equal(subject.canExecute(), true);
      subject.execute();
      assert.equal(calls, 1, `${testRole} authorized ${method} sends exactly once`);
    }
    consoleChecks++;
  }
}
console.log(`PASS: ${consoleChecks} Test Console handler scenarios; Read-only write requests send nothing, preserve state, and require the matching action before execution.`);



role = 'ApiOwner';
profiles = [{ applicationId: 'app', apiId: 'api', releaseScopeId: '00000000-0000-0000-0000-000000000000', profile: 'Viewer' }];
grants = [{ applicationId: 'app', apiId: 'api', versionId: 'version', endpointId: 'endpoint', environmentId: 'environment', canCreate: true, canEdit: true }];
assert.equal(permissions.canCreate('api'), false, 'Viewer overrides legacy Create');
assert.equal(permissions.canEdit('api'), false, 'Viewer overrides legacy Edit');
assert.equal(permissions.canRegisterApi('app'), false);
assert.equal(permissions.canDelete('api'), false);
assert.equal(permissions.canExecute('endpoint', 'environment', 'POST'), true, 'Existing execution rights remain separate');
grants = [];
assert.equal(permissions.canExecute('endpoint', 'environment', 'GET'), false, 'Viewer adds no execution right');
profiles[0].profile = 'Maintainer';
assert.equal(permissions.canCreate('api'), true);
assert.equal(permissions.canEdit('api'), true);
assert.equal(permissions.canDelete('api'), false);
profiles[0].profile = 'Manager';
assert.equal(permissions.canDelete('api'), true);
profiles[0].releaseScopeId = 'release';
assert.equal(permissions.canCreate('api'), false);
assert.equal(permissions.canEdit('api', 'release'), true);
assert.equal(permissions.canEdit('api', 'other-release'), false);
assert.equal(permissions.canDelete('api'), false);
profiles[0].profile = 'None';
assert.equal(permissions.canEdit('api', 'release'), false);
console.log('PASS: Viewer, Maintainer, Manager, revoked profiles, legacy precedence, release scope, and independent execution access.');
