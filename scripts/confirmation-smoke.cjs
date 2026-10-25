// Run from the frontend root: node scripts/confirmation-smoke.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src/app');
const read = file => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
function walk(node, visit) { visit(node); ts.forEachChild(node, child => walk(child, visit)); }
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.ts') ? [path.join(dir, entry.name)] : []); }
function klass(source) { return source.statements.find(ts.isClassDeclaration); }
const writes = new Set();
for (const file of [...files(path.join(root, 'core/services')), ...files(path.join(root, 'core/auth'))]) {
  const source = read(file), type = klass(source);
  if (!type) continue;
  for (const member of type.members.filter(ts.isMethodDeclaration)) walk(member, node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['post','put','patch','delete'].includes(node.expression.name.text)) writes.add(`${type.name.text}.${member.name.getText(source)}`);
  });
}
// These are executions/sign-in, rather than CRUD saves. They retain their current behavior.
const nonCrud = new Set(['AuthService.login', 'TestClient.execute', 'ApiCatalogClient.testAuthenticationProfile']);
const covered = new Set();
let sites = 0;
for (const file of [...files(path.join(root, 'features')), ...files(path.join(root, 'layout'))]) {
  const source = read(file), type = klass(source);
  if (!type) continue;
  const injections = new Map();
  for (const member of type.members.filter(ts.isPropertyDeclaration)) {
    const init = member.initializer;
    if (init && ts.isCallExpression(init) && init.expression.getText(source) === 'inject') injections.set(member.name.getText(source), init.arguments[0].getText(source));
  }
  for (const method of type.members.filter(ts.isMethodDeclaration)) walk(method, node => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    const expr = node.expression, receiver = expr.expression;
    if (!ts.isPropertyAccessExpression(receiver) || receiver.expression.kind !== ts.SyntaxKind.ThisKeyword) return;
    const mutation = `${injections.get(receiver.name.text)}.${expr.name.text}`;
    if (!writes.has(mutation) || nonCrud.has(mutation)) return;
    const name = `${type.name.text}.${method.name.getText(source)}`;
    if (name === 'BusinessAreasComponent.delete') {
      const template = fs.readFileSync(file.replace('.ts', '.html'), 'utf8');
      assert.match(template, /title="Delete business area\?"/);
      assert.match(template, /\(click\)="delete\(\)"/);
    } else {
      assert.match(method.getText(source), /if\s*\(\s*!confirmMutation\(/, `Missing confirmation: ${name} -> ${mutation}`);
      assert.ok(method.getText(source).indexOf('confirmMutation(') < node.pos - method.pos, `Confirmation must precede request: ${name}`);
    }
    covered.add(name); sites++;
  });
}

const helperSource = fs.readFileSync(path.join(root, 'shared/confirm-mutation.ts'), 'utf8');
const compiledHelper = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const helper = { exports: {} };
new Function('exports', compiledHelper)(helper.exports);
let prompts = [], decision = false;
global.window = { confirm(message) { prompts.push(message); return decision; } };
const confirmMutation = helper.exports.confirmMutation;
assert.equal(confirmMutation('create', 'this API registration'), false);
decision = true;
assert.equal(confirmMutation('update', 'this API registration'), true);

function method(file, name, extras = {}) {
  const source = read(path.join(root, file));
  const body = klass(source).members.find(n => ts.isMethodDeclaration(n) && n.name.getText(source) === name).body.getText(source);
  const js = ts.transpileModule(`function invoke() ${body}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('confirmMutation', ...Object.keys(extras), js + '; return invoke;')(confirmMutation, ...Object.values(extras));
}
let requests = 0, busy = false;
const value = { name: 'Example API', publishingApplicationId: 'publisher', protocol: 'Rest', description: 'Keep entered values' };
const form = { invalid: false, controls: { ownershipType: { value: 'Internal' } }, getRawValue: () => value, markAllAsTouched() {} };
const state = {
  form, canSave: () => true, apiId: null, saving: Object.assign(() => busy, { set(v) { busy = v; } }), errorMessage: { set() {} },
  apiClient: { create() { requests++; return { subscribe() {} }; }, update() { requests++; return { subscribe() {} }; } }
};
const save = method('features/apis/api-form.component.ts', 'save', { ApiOwnershipType: { ThirdParty: 'ThirdParty' } });
decision = false;
save.call(state);
assert.equal(requests, 0); assert.equal(busy, false); assert.equal(value.description, 'Keep entered values');
state.apiId = 'existing'; save.call(state); assert.equal(requests, 0);
decision = true; save.call(state); assert.equal(requests, 1); assert.equal(busy, true);
busy = false; form.invalid = true; const before = prompts.length; save.call(state); assert.equal(prompts.length, before);

decision = false;
const permissions = method('features/security/permissions.component.ts', 'save');
permissions.call({ selectedRoleId: () => 'role', saving: Object.assign(() => false, { set() { throw Error('Cancelled save changed busy state'); } }) });
const secret = method('features/apis/api-detail.component.ts', 'saveSecret');
secret.call({ secretForm: { invalid: false, getRawValue() { throw Error('Secret payload should not be read after cancellation'); } }, modalSaving: () => false, modalVersion: () => ({ id: 'release' }), secretEnvironment: () => ({ id: 'environment' }) });
assert.ok(prompts.every(message => !message.includes('Keep entered values')));
delete global.window;
assert.equal(confirmMutation('save', 'this record'), false);
console.log(`PASS: ${sites} mutation call sites in ${covered.size} handlers guarded; existing delete dialog verified; Cancel sends no request and preserves form/busy state; OK sends once; invalid forms do not prompt.`);
