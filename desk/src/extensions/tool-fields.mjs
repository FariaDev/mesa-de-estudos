/* Campos das ferramentas do tutor — UMA descrição, lida pelos dois motores.
   O guia de cada ferramenta (`guide.mjs`) declara os campos como dados simples;
   `toZod` monta o esquema do Claude (SDK) e `toTypebox` o do Pi (extensão).
   Quem recebe a biblioteca é o chamador: este módulo não importa zod nem
   TypeBox. `canonical` reduz qualquer JSON Schema ao que importa para o
   modelo (tipo, limites, opções, obrigatórios e textos), e é com ele que os
   testes provam que os dois lados mostram ao modelo o mesmo esquema.

   Um campo: {type, min?, max?, values?, value?, of?, fields?, optional?,
   default?, description?, trim?}. `trim` só existe no Claude (o zod apara
   antes de validar); não muda o esquema que o modelo vê. */

export function toZod(z, field) {
  let schema;
  switch (field.type) {
    case 'string':
      schema = z.string();
      if (field.trim) schema = schema.trim();
      if (field.min != null) schema = schema.min(field.min);
      if (field.max != null) schema = schema.max(field.max);
      break;
    case 'integer':
    case 'number':
      schema = field.type === 'integer' ? z.number().int() : z.number();
      if (field.min != null) schema = schema.min(field.min);
      if (field.max != null) schema = schema.max(field.max);
      break;
    case 'boolean': schema = z.boolean(); break;
    case 'enum': schema = z.enum(field.values); break;
    case 'literal': schema = z.literal(field.value); break;
    case 'anyOf': schema = z.union(field.of.map((entry) => toZod(z, entry))); break;
    case 'object': schema = z.object(zodShape(z, field.fields)); break;
    default: throw Error(`tipo de campo desconhecido: ${field.type}`);
  }
  if (field.default !== undefined) schema = schema.default(field.default);
  else if (field.optional) schema = schema.optional();
  if (field.description) schema = schema.describe(field.description);
  return schema;
}

/* O SDK do Claude recebe a forma crua (`{campo: zod}`), não um z.object. */
export function zodShape(z, fields) {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, toZod(z, field)]));
}

export function toTypebox(Type, field) {
  const options = {};
  if (field.description) options.description = field.description;
  if (field.default !== undefined) options.default = field.default;
  let schema;
  switch (field.type) {
    case 'string':
      if (field.min != null) options.minLength = field.min;
      if (field.max != null) options.maxLength = field.max;
      schema = Type.String(options);
      break;
    case 'integer':
    case 'number':
      if (field.min != null) options.minimum = field.min;
      if (field.max != null) options.maximum = field.max;
      schema = field.type === 'integer' ? Type.Integer(options) : Type.Number(options);
      break;
    case 'boolean': schema = Type.Boolean(options); break;
    case 'enum': schema = Type.Union(field.values.map((value) => Type.Literal(value)), options); break;
    case 'literal': schema = Type.Literal(field.value, options); break;
    case 'anyOf': schema = Type.Union(field.of.map((entry) => toTypebox(Type, entry)), options); break;
    case 'object': schema = typeboxObject(Type, field.fields, options); break;
    default: throw Error(`tipo de campo desconhecido: ${field.type}`);
  }
  return field.optional || field.default !== undefined ? Type.Optional(schema) : schema;
}

export function typeboxObject(Type, fields, options = {}) {
  return Type.Object(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, toTypebox(Type, field)])), options);
}

/* JSON Schema → forma comparável. Zod e TypeBox escrevem a mesma coisa de
   jeitos diferentes (`enum` × `anyOf` de `const`, `additionalProperties`,
   `$schema`); aqui sobra só o que o modelo usa para montar a chamada. */
export function canonical(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  const options = schema.anyOf || schema.oneOf;
  const consts = options && options.every((entry) => entry && 'const' in entry) ? options.map((entry) => entry.const) : null;
  if (Array.isArray(schema.enum) || consts) {
    out.type = 'enum';
    out.values = [...(schema.enum || consts)].map(String).sort();
  } else if ('const' in schema) {
    out.type = 'literal';
    out.value = schema.const;
  } else if (options) {
    out.type = 'anyOf';
    out.of = options.map(canonical);
  } else if (schema.type === 'object') {
    out.type = 'object';
    out.fields = Object.fromEntries(Object.keys(schema.properties || {}).sort().map((name) => [name, canonical(schema.properties[name])]));
    out.required = [...(schema.required || [])].sort();
  } else {
    out.type = schema.type;
    for (const [from, to] of [['minLength', 'min'], ['maxLength', 'max'], ['minimum', 'min'], ['maximum', 'max']]) {
      if (schema[from] != null) out[to] = schema[from];
    }
  }
  if (schema.description) out.description = schema.description;
  if (schema.default !== undefined) out.default = schema.default;
  return out;
}

/* A forma comparável direto da descrição, sem passar por biblioteca. */
export function canonicalFields(fields) {
  return canonical(jsonSchemaOf(fields));
}

/* O JSON Schema da descrição, sem biblioteca: é o `inputSchema` do MCP `mesa`
   que a Mesa registra no OpenCode (#57). Chave sem valor some no JSON. */
export function jsonSchemaOf(fields) {
  const toJson = (field) => {
    const base = {description: field.description, default: field.default};
    switch (field.type) {
      case 'string': return {type: 'string', minLength: field.min, maxLength: field.max, ...base};
      case 'integer': case 'number': return {type: field.type, minimum: field.min, maximum: field.max, ...base};
      case 'boolean': return {type: 'boolean', ...base};
      case 'enum': return {enum: field.values, ...base};
      case 'literal': return {const: field.value, ...base};
      case 'anyOf': return {anyOf: field.of.map(toJson), ...base};
      case 'object': return {...objectJson(field.fields), ...base};
      default: throw Error(`tipo de campo desconhecido: ${field.type}`);
    }
  };
  const objectJson = (entries) => ({
    type: 'object',
    properties: Object.fromEntries(Object.entries(entries).map(([name, field]) => [name, toJson(field)])),
    required: Object.entries(entries).filter(([, field]) => !field.optional && field.default === undefined).map(([name]) => name),
  });
  return JSON.parse(JSON.stringify(objectJson(fields)));
}
