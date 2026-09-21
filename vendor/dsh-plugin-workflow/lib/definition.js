import Ajv from "ajv";
import graphlib from "@dagrejs/graphlib";
import logic from "json-logic-js";

export const kinds = [
  "input",
  "interact",
  "agent",
  "tool",
  "condition",
  "join",
  "loop",
  "subworkflow",
  "approval",
  "artifact",
  "publish",
];
export const interactions = ["once", "goal"];
const route = {
  type: "object",
  additionalProperties: false,
  required: ["mode"],
  properties: {
    mode: { enum: ["inherit", "explicit"] },
    id: { type: "string", minLength: 1 },
  },
};
export const schema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "id", "name", "nodes", "edges"],
  properties: {
    schemaVersion: { const: "1.0" },
    id: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,80}$" },
    name: { type: "string", minLength: 1, maxLength: 160 },
    description: { type: "string", maxLength: 4000 },
    icon: { enum: ["workflow", "book", "search", "code", "file", "sparkles"] },
    inputSchema: { type: "object" },
    trigger: { enum: ["material", "every-message", "manual"] },
    nodes: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "kind"],
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,80}$" },
          name: { type: "string", minLength: 1, maxLength: 160 },
          kind: { enum: kinds },
          subagents: { type: "array", maxItems: 8, items: {
            type: "object", additionalProperties: false, required: ["id", "name", "prompt"],
            properties: {
              id: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,80}$" },
              name: { type: "string", minLength: 1, maxLength: 160 },
              prompt: { type: "string", minLength: 1, maxLength: 100000 },
              dependsOn: { type: "array", items: { type: "string" }, uniqueItems: true },
              input: { type: "object" },
              outputSchema: { type: 'object' },
              executor: { type: "string", minLength: 1 }, provider: route, model: route, effort: route,
              tools: { type: "array", items: { type: "string" }, uniqueItems: true },
          skills: { type: "array", items: { type: "string" }, uniqueItems: true },
            },
          } },
          executor: { type: "string", minLength: 1 },
          resultMember: { type: 'string' },
          exportMarkdown: { type: 'boolean' },
          provider: route,
          model: route,
          effort: route,
          prompt: { type: "string", maxLength: 100000 },
          repeat: {
            type: 'object', additionalProperties: false,
            required: ['target', 'until', 'maxRounds', 'sessionMode'],
            properties: {
              target: { type: 'string' }, until: {},
              maxRounds: { type: 'integer', minimum: 1, maximum: 20 },
              sessionMode: { enum: ['continue', 'new'] },
            },
          },
          input: { type: "object" },
          outputSchema: { type: "object" },
          tools: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
          skillOverrides: {type:"object",additionalProperties:{type:"string",maxLength:200000}},
          skills: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
          tool: { type: "string" },
          interaction: { enum: interactions },
          provided: {},
          condition: {},
          workflow: {
            type: "object",
            required: ["id", "revision"],
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              revision: { type: "integer", minimum: 1 },
            },
          },
          maxItems: { type: "integer", minimum: 1, maximum: 100 },
          maxTurns: { type: "integer", minimum: 1, maximum: 20 },
          timeoutSeconds: { type: "integer", minimum: 1, maximum: 3600 },
          maxAttempts: { type: "integer", minimum: 1, maximum: 5 },
          effects: { enum: ["read-only", "write"] },
          format: { enum: ["text/markdown", "text/plain", "application/json"] },
          position: {
            type: "object",
            required: ["x", "y"],
            additionalProperties: false,
            properties: { x: { type: "number" }, y: { type: "number" } },
          },
        },
      },
    },
    edges: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          on: { enum: ["success", "true", "false"] },
        },
      },
    },
    outputs: { type: "object" },
    limits: {
      type: "object",
      additionalProperties: false,
      properties: {
        concurrency: { type: "integer", minimum: 1, maximum: 8 },
        maxNodeCalls: { type: "integer", minimum: 1, maximum: 500 },
        timeoutSeconds: { type: "integer", minimum: 1, maximum: 86400 },
      },
    },
  },
};
const ajv = new Ajv({ allErrors: true, strict: false });
const validateShape = ajv.compile(schema);
export class WorkflowError extends Error {
  constructor(code, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}
export const fail = (code, detail) => {
  throw new WorkflowError(code, detail);
};
export function checkData(schema, data, code = "INPUT_SCHEMA") {
  const validate = ajv.compile(schema);
  if (!validate(data)) fail(code, ajv.errorsText(validate.errors));
}
export function pointer(value, path = "") {
  if (!path) {
    if (value === undefined) fail("MISSING_INPUT");
    return value;
  }
  if (typeof path !== "string" || !path.startsWith("/"))
    fail("INVALID_POINTER", String(path));
  for (const raw of path.slice(1).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      ["__proto__", "constructor", "prototype"].includes(key) ||
      value == null ||
      !Object.hasOwn(value, key)
    )
      fail("MISSING_INPUT", path);
    value = value[key];
  }
  return value;
}
export function mapInputs(mapping = {}, input, outputs) {
  return Object.fromEntries(
    Object.entries(mapping).map(([key, ref]) => {
      if (ref?.source === "workflow") return [key, pointer(input, ref.path)];
      if (ref?.source === "node")
        return [key, pointer(outputs[ref.nodeId], ref.path)];
      if (ref?.source === "literal") return [key, ref.value];
      fail("INVALID_INPUT_REFERENCE", key);
    }),
  );
}
export function validateDefinition(def) {
  if (!validateShape(def))
    fail("DEFINITION_SCHEMA", ajv.errorsText(validateShape.errors));
  const graph = new graphlib.Graph({ directed: true });
  for (const node of def.nodes) {
    if (graph.hasNode(node.id)) fail("DUPLICATE_NODE", node.id);
    graph.setNode(node.id);
    if (node.subagents?.length && node.kind !== "agent") fail("TEAM_REQUIRES_AGENT", node.id);
    if (node.resultMember && !node.subagents?.some(m => m.id === node.resultMember)) fail('RESULT_MEMBER_REQUIRED', node.id);
    if (new Set(node.subagents?.map(m => m.id)).size !== (node.subagents?.length ?? 0)) fail("DUPLICATE_SUBAGENT", node.id);
    if (!node.name.trim()) fail('NAME_REQUIRED', node.id);
    for (const member of node.subagents ?? []) {
      if (!member.name.trim() || !member.prompt.trim()) fail('PROMPT_REQUIRED', `${node.id}.${member.id}`);
      for (const field of ['provider', 'model', 'effort'])
        if (member[field]?.mode === 'explicit' && !member[field].id?.trim()) fail('ROUTE_ID_REQUIRED', `${node.id}.${member.id}.${field}`);
    }
    const teamGraph = new graphlib.Graph({ directed: true });
    for (const member of node.subagents ?? []) teamGraph.setNode(member.id);
    for (const member of node.subagents ?? []) {
      for (const dependency of member.dependsOn ?? []) {
        if (!teamGraph.hasNode(dependency)) fail('UNKNOWN_SUBAGENT_DEPENDENCY', dependency);
        teamGraph.setEdge(dependency, member.id);
      }
    }
    if (!graphlib.alg.isAcyclic(teamGraph)) fail('SUBAGENT_CYCLE', node.id);
    for (const member of node.subagents ?? []) {
      const ancestors = new Set();
      const visit = id => { for (const p of teamGraph.predecessors(id) ?? []) if (!ancestors.has(p)) { ancestors.add(p); visit(p); } };
      visit(member.id);
      for (const ref of Object.values(member.input ?? {})) {
        validateReference(ref);
        if (ref.source === 'node' && !ancestors.has(ref.nodeId)) fail('SUBAGENT_INPUT_DEPENDENCY_REQUIRED', member.id);
      }
    }
    for (const field of ["provider", "model", "effort"])
      if (node[field]?.mode === "explicit" && !node[field].id)
        fail("ROUTE_ID_REQUIRED", `${node.id}.${field}`);
    if (
      ["agent", "interact"].includes(node.kind) &&
      !node.prompt?.trim()
    )
      fail("PROMPT_REQUIRED", node.id);
    if (node.kind === "interact" && node.maxTurns && node.interaction !== "goal")
      fail("INTERACTION_TURNS_UNUSED", node.id);
    if (node.kind === "tool" && !node.tool) fail("TOOL_REQUIRED", node.id);
    if (["loop", "subworkflow"].includes(node.kind) && !node.workflow)
      fail("WORKFLOW_REQUIRED", node.id);
    if (node.kind === "loop" && !node.maxItems)
      fail("LOOP_LIMIT_REQUIRED", node.id);
    if (node.kind === "condition") {
      if (node.condition === undefined) fail("CONDITION_REQUIRED", node.id);
      validateCondition(node.condition);
    }
    if (node.outputSchema) {
      if (node.outputSchema.type !== "object")
        fail("OBJECT_SCHEMA_REQUIRED", node.id);
      ajv.compile(node.outputSchema);
    }
  }
  for (const edge of def.edges) {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to))
      fail("UNKNOWN_EDGE_NODE");
    if (graph.hasEdge(edge.from, edge.to)) fail("DUPLICATE_EDGE");
    if (
      edge.on &&
      edge.on !== "success" &&
      def.nodes.find((n) => n.id === edge.from).kind !== "condition"
    )
      fail("CONDITION_EDGE_REQUIRED");
    graph.setEdge(edge.from, edge.to);
  }
  if (!graphlib.alg.isAcyclic(graph)) fail("CYCLE", "Use a bounded loop node");
  const ancestors = (id) => {
    const seen = new Set();
    const visit = (key) => {
      for (const p of graph.predecessors(key) ?? [])
        if (!seen.has(p)) {
          seen.add(p);
          visit(p);
        }
    };
    visit(id);
    return seen;
  };
  for (const node of def.nodes) {
    if (node.repeat) {
      if (node.kind !== 'agent') fail('REPEAT_REQUIRES_AGENT', node.id);
      if (!ancestors(node.id).has(node.repeat.target)) fail('REPEAT_TARGET_MUST_BE_UPSTREAM', node.id);
      if (def.nodes.find(n => n.id === node.repeat.target)?.kind !== 'agent') fail('REPEAT_TARGET_REQUIRES_AGENT', node.id);
      validateCondition(node.repeat.until);
    }
    for (const match of (node.prompt ?? "").matchAll(/\{\{(?:input|node)\.([a-zA-Z0-9_-]+)\}\}/g))
      if (!Object.hasOwn(node.input ?? {}, match[1])) fail("PROMPT_INPUT_MISSING", match[1]);
    for (const ref of Object.values(node.input ?? {})) {
      validateReference(ref);
      if (ref.source === "node" && !ancestors(node.id).has(ref.nodeId))
        fail("INPUT_DEPENDENCY_REQUIRED", `${node.id} <- ${ref.nodeId}`);
    }
    if (node.provided !== undefined) {
      validateReference(node.provided);
      if (
        node.provided.source === "node" &&
        !ancestors(node.id).has(node.provided.nodeId)
      )
        fail("INPUT_DEPENDENCY_REQUIRED", `${node.id} <- ${node.provided.nodeId}`);
    }
  }
  for (const ref of Object.values(def.outputs ?? {})) {
    validateReference(ref);
    if (ref.source === "node" && !graph.hasNode(ref.nodeId))
      fail("UNKNOWN_OUTPUT_NODE");
  }
  if (def.inputSchema) ajv.compile(def.inputSchema);
  return graphlib.alg.topsort(graph);
}
function validateReference(ref) {
  if (!ref || !["workflow", "node", "literal"].includes(ref.source))
    fail("INVALID_INPUT_REFERENCE");
  if (ref.source === "literal" && !Object.hasOwn(ref, "value"))
    fail("LITERAL_VALUE_REQUIRED");
  if (ref.source === "node" && typeof ref.nodeId !== "string")
    fail("INPUT_NODE_REQUIRED");
  if (
    ref.path !== undefined &&
    (typeof ref.path !== "string" ||
      (ref.path !== "" && !ref.path.startsWith("/")) ||
      /~(?![01])/.test(ref.path))
  )
    fail("INVALID_POINTER");
}
function validateCondition(expression) {
  const allowed = new Set([
    "var",
    "==",
    "===",
    "!=",
    "!==",
    ">",
    ">=",
    "<",
    "<=",
    "!",
    "!!",
    "and",
    "or",
    "in",
    "missing",
  ]);
  const visit = (v, depth = 0) => {
    if (depth > 20) fail("CONDITION_TOO_DEEP");
    if (Array.isArray(v)) return v.forEach((x) => visit(x, depth + 1));
    if (v && typeof v === "object")
      for (const [op, args] of Object.entries(v)) {
        if (!allowed.has(op)) fail("CONDITION_OPERATOR", op);
        visit(args, depth + 1);
      }
  };
  visit(expression);
}
export function evaluateCondition(expression, input) {
  validateCondition(expression);
  return Boolean(logic.apply(expression, input));
}
