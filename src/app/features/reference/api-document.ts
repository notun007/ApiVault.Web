import { ApiDetailResponse, ApiVersionResponse } from '../../core/models/api.models';

type Obj = Record<string, any>;
const sensitive = /^(authorization|proxy-authorization|cookie|set-cookie|password|passwd|client_secret|clientsecret|access_token|accesstoken|refresh_token|refreshtoken|api[-_]?key|token|secret)$/i;

export function redact(value: any): any {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sensitive.test(k) ? '[REDACTED]' : redact(v)]));
  return value;
}

function parse(value?: string | null): any {
  if (!value?.trim()) return undefined;
  try { return redact(JSON.parse(value)); } catch { return value; }
}

function schema(value: any): Obj {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) return { type: 'array', items: value.length ? schema(value[0]) : {} };
  if (typeof value === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, schema(v)])) };
  return { type: typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : typeof value === 'boolean' ? 'boolean' : 'string' };
}

function parameters(raw: string | null | undefined, location: string): Obj[] {
  const data = parse(raw);
  const entries: Obj[] = Array.isArray(data) ? data : data && typeof data === 'object' ? Object.entries(data).map(([name, value]) => ({ name, ...(value && typeof value === 'object' ? value : { example: value }) })) : [];
  return entries.filter(x => x && typeof x === 'object' && typeof x['name'] === 'string').map(x => {
    const example = sensitive.test(x['name']) ? '[REDACTED]' : x['example'] ?? x['sample'] ?? x['value'];
    return { name: x['name'], in: location, required: location === 'path' || x['required'] === true, description: x['description'] ?? '', schema: x['schema'] ?? { type: x['type'] ?? 'string' }, ...(example !== undefined ? { example } : {}) };
  });
}

function content(sample?: string | null): Obj {
  const example = parse(sample);
  if (example === undefined) return {};
  const media = typeof example === 'string' ? (example.trim().startsWith('<') ? 'application/xml' : 'text/plain') : 'application/json';
  return { [media]: { schema: schema(example), example } };
}

function security(version: ApiVersionResponse): Obj | undefined {
  const config = parse(version.authenticationConfigJson) ?? {};
  switch (version.authenticationType) {
    case 'Bearer': return { type: 'http', scheme: 'bearer' };
    case 'OAuth2': return { type: 'http', scheme: 'bearer', description: 'OAuth2 access token. See the release authentication guidance for token acquisition.' };
    case 'Basic': return { type: 'http', scheme: 'basic' };
    case 'ApiKey': return { type: 'apiKey', in: ['header', 'query', 'cookie'].includes(config['in']) ? config['in'] : 'header', name: config['headerName'] ?? config['name'] ?? 'X-API-Key' };
    case 'MutualTls': return { type: 'mutualTLS' };
    default: return undefined;
  }
}

export function createCatalogDocument(api: ApiDetailResponse, version: ApiVersionResponse): Obj {
  const scheme = security(version);
  const paths: Obj = {};
  for (const endpoint of version.endpoints) {
    const path = '/' + endpoint.relativePath.replace(/^\/+/, '');
    const method = endpoint.httpMethod.toLowerCase();
    if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'].includes(method)) continue;
    const params = [...parameters(endpoint.pathParametersJson, 'path'), ...parameters(endpoint.queryParametersJson, 'query'), ...parameters(endpoint.requestHeadersJson, 'header').filter(p => !sensitive.test(p['name']) && !/^(accept|content-type)$/i.test(p['name']))];
    for (const match of path.matchAll(/\{([^}]+)\}/g)) if (!params.some(p => p['in'] === 'path' && p['name'] === match[1])) params.push({ name: match[1], in: 'path', required: true, schema: { type: 'string' } });
    const codes = parse(endpoint.successStatusCodesJson);
    const statuses = Array.isArray(codes) ? codes.map(String).filter(c => /^[1-5]\d\d$/.test(c)) : [];
    const responseContent = content(endpoint.responseBodySample);
    const responseHeaders = Object.fromEntries(parameters(endpoint.responseHeadersSampleJson, 'header').map(p => [p['name'], { description: p['description'], schema: p['schema'], ...(p['example'] !== undefined ? { example: p['example'] } : {}) }]));
    const operation: Obj = {
      operationId: `endpoint_${endpoint.id.replaceAll('-', '')}`,
      summary: endpoint.name, description: endpoint.description ?? '',
      parameters: params,
      security: endpoint.authenticationMode === 'Anonymous' || !scheme ? [] : [{ releaseAuth: [] }],
      'x-authentication': endpoint.authenticationMode === 'Anonymous' ? 'None (anonymous endpoint)' : version.authenticationType,
      responses: Object.fromEntries((statuses.length ? statuses : ['default']).map(code => [code, { description: statuses.length ? 'Documented success response' : 'Registered response; status codes not specified', ...(Object.keys(responseContent).length ? { content: responseContent } : {}), ...(Object.keys(responseHeaders).length ? { headers: responseHeaders } : {}) }])),
      'x-execution-limits': { timeoutSeconds: endpoint.timeoutSeconds ?? version.timeoutSeconds, maxRequestBytes: endpoint.maxRequestBytes ?? version.maxRequestBytes, maxResponseBytes: endpoint.maxResponseBytes ?? version.maxResponseBytes }
    };
    const body = content(endpoint.requestPayloadSample);
    if (Object.keys(body).length && !['get', 'head'].includes(method)) operation['requestBody'] = { content: body };
    if (endpoint.soapAction) operation['x-soap-action'] = endpoint.soapAction;
    // Registration permits multiple operations for a path; preserve each HTTP method.
    (paths[path] ??= {})[method] = operation;
  }
  return {
    openapi: '3.1.0',
    info: { title: api.name, version: version.version, description: [api.description, version.releaseName, version.authenticationInstructions].filter(Boolean).join('\n\n') },
    servers: version.environments.filter(e => e.isEnabled).map(e => ({ url: e.baseUrl, description: e.environmentType })),
    paths,
    components: { securitySchemes: scheme ? { releaseAuth: scheme } : {} },
    'x-apivault': { apiId: api.id, versionId: version.id, protocol: api.protocol, publisher: api.publishingApplication.name, ownership: api.ownershipType, creator: api.creatorName, vendor: api.vendorName ?? 'In-house', businessArea: api.businessArea.name, lifecycle: version.lifecycleStatus, releaseName: version.releaseName ?? '', releaseDate: version.releaseDateUtc ?? '', authentication: version.authenticationType, authenticationInstructions: version.authenticationInstructions ?? '', changeLog: version.changeLog ?? '' }
  };
}

export interface DocumentBlock { title: string; text: string; code?: boolean; }
export function documentBlocks(doc: Obj): DocumentBlock[] {
  const meta = doc['x-apivault'] ?? {};
  const blocks: DocumentBlock[] = [
    { title: 'Release', text: `${doc['info']['version']} · ${meta['releaseName']}\nStatus: ${meta['lifecycle']}\nRelease date: ${meta['releaseDate'] || 'Not specified'}` },
    { title: 'API information', text: `Publisher: ${meta['publisher']}\nBusiness area: ${meta['businessArea']}\nProtocol: ${meta['protocol']}\nOwnership: ${meta['ownership']}\nCreator: ${meta['creator']}\nVendor: ${meta['vendor']}\n\n${doc['info']['description'] || ''}` },
    { title: 'Authentication', text: `${meta['authentication']}\n${meta['authenticationInstructions'] || 'No additional guidance registered.'}` },
    { title: 'Environments', text: doc['servers'].map((s: Obj) => `${s['description']}: ${s['url']}`).join('\n') || 'No enabled environments registered.' }
  ];
  for (const [path, methods] of Object.entries(doc['paths'] as Obj)) for (const [method, value] of Object.entries(methods as Obj)) {
    const op = value as Obj;
    blocks.push({ title: `${method.toUpperCase()} ${path}`, text: `${op['summary']}\n${op['description']}\nAuthentication: ${op['x-authentication']}\nExecution limits: ${JSON.stringify(op['x-execution-limits'])}` });
    if (op['parameters'].length) blocks.push({ title: 'Parameters', text: JSON.stringify(op['parameters'], null, 2), code: true });
    if (op['requestBody']) blocks.push({ title: 'Request body', text: JSON.stringify(op['requestBody'], null, 2), code: true });
    blocks.push({ title: 'Responses and status codes', text: JSON.stringify(op['responses'], null, 2), code: true });
  }
  if (meta['changeLog']) blocks.push({ title: 'Change log', text: meta['changeLog'] });
  return blocks;
}
