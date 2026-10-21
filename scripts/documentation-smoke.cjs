// Run from the frontend root: node scripts/documentation-smoke.cjs
// Compiles the pure documentation helpers in memory; does not call a live API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.join(root, 'src/app/features/reference', name + '.ts');
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  const requireOriginal = m.require.bind(m);
  m.require = id => id === './api-document' ? load('api-document') : requireOriginal(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  cache.set(name, m.exports);
  return m.exports;
}

(async () => {
  const { createCatalogDocument, documentBlocks } = load('api-document');
  const endpoint = { id: 'fixture-endpoint', name: 'Create payment', relativePath: '/customers/{customerId}/payments', httpMethod: 'POST', authenticationMode: 'Inherit',
    pathParametersJson: '[]', queryParametersJson: '[null,{"name":"limit","type":"integer","example":10}]',
    requestHeadersJson: '{"Authorization":"DO_NOT_EXPORT","X-Request-ID":"example-id"}',
    requestPayloadSample: '{"amount":10,"password":"DO_NOT_EXPORT","nested":{"client_secret":"DO_NOT_EXPORT"}}',
    responseBodySample: '{"accessToken":"DO_NOT_EXPORT","status":"ok"}', responseHeadersSampleJson: '{"Set-Cookie":"DO_NOT_EXPORT"}', successStatusCodesJson: '[200,201]', timeoutSeconds: 12 };
  const version = { id: 'fixture-release', version: '2.3.4', lifecycleStatus: 'Draft', authenticationType: 'Bearer', releaseName: 'Regression fixture', timeoutSeconds: 30, maxRequestBytes: 1024, maxResponseBytes: 4096,
    endpoints: [endpoint, { ...endpoint, id: 'fixture-get', httpMethod: 'GET', authenticationMode: 'Anonymous' }],
    environments: [{ baseUrl: 'https://api.example.test', environmentType: 'Sandbox', isEnabled: true, secretNames: ['DO_NOT_EXPORT'] }, { baseUrl: 'https://disabled.example.test', isEnabled: false }],
    changeLog: 'End of document marker', authenticationProfile: { configurationJson: '{"secret":"DO_NOT_EXPORT"}' } };
  const api = { id: 'fixture-api', name: 'Payments API', description: 'Fixture documentation', protocol: 'Rest', ownershipType: 'Internal', creatorName: 'Example User', businessArea: { name: 'Payments' }, publishingApplication: { name: 'Payments service' } };
  const doc = createCatalogDocument(api, version);
  const post = doc.paths[endpoint.relativePath].post;
  assert.equal(doc.info.version, '2.3.4');
  assert.equal(doc['x-apivault'].versionId, 'fixture-release');
  assert.equal(doc.servers.length, 1);
  assert.equal(post.parameters.find(p => p.name === 'customerId').required, true);
  assert.equal(post.parameters.find(p => p.name === 'limit').schema.type, 'integer');
  assert.equal(post['x-execution-limits'].timeoutSeconds, 12);
  assert.deepEqual(Object.keys(post.responses), ['200', '201']);
  assert.deepEqual(doc.paths[endpoint.relativePath].get.security, []);
  assert.equal(doc.paths[endpoint.relativePath].get.requestBody, undefined);
  assert.equal(JSON.stringify(doc).includes('DO_NOT_EXPORT'), false);
  assert.ok(JSON.stringify(doc).includes('[REDACTED]'));
  assert.ok(documentBlocks(doc).some(b => b.title === 'Parameters'));
  assert.ok(documentBlocks(doc).some(b => b.title === 'Responses and status codes'));
  const empty = createCatalogDocument(api, { ...version, endpoints: [], environments: [] });
  assert.deepEqual(empty.paths, {});
  assert.deepEqual(empty.servers, []);
  const longDoc = { ...doc, info: { ...doc.info, description: ('Long documentation paragraph with wrapped text and readable line breaks.\n').repeat(160) } };
  const { createDocumentPdf } = load('document-pdf');
  const blob = createDocumentPdf(longDoc);
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  // Optional path allows the same PDF to be rendered and inspected during QA.
  if (process.argv[2]) fs.writeFileSync(process.argv[2], bytes);
  console.log('PASS: release identity, method/path preservation, anonymous auth, inferred parameters, limits, status codes, disabled environments, redaction, empty releases, and PDF generation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
