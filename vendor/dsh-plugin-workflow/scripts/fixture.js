import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../runtime/package.json", import.meta.url),
);
const { LlmAdapter } = await import(require.resolve("@deepseek-ai/dsh-llm"));
export const name = "workflow-verification-fixture";
export const inject = ["llm", "connection", "agents", "directoryPicker", "attachments", "workspaceRegistry", "tools"];
export function apply(ctx, config) {
  const calls = [];
  const handles = [];
  class FixtureAdapter extends LlmAdapter {
    async listModels(provider) {
      return [
        { provider, id: "fixture-root", name: "Fixture Root" },
        { provider, id: "fixture-node", name: "Fixture Node" },
      ];
    }
    async resolveModel(provider, model) {
      return {
        provider,
        id: model,
        name: model,
        reasoning: {
          efforts: [
            { id: "low", name: "Low" },
            { id: "high", name: "High" },
          ],
        },
      };
    }
    async *stream(options) {
      options.signal?.throwIfAborted();
      calls.push({
        provider: options.provider,
        model: options.model,
        effort: options.reasoningEffort,
        tools: options.tools?.map((t) => t.name) ?? [],
      });
      const text =
        "# Workflow verification\n\nSynthetic local execution completed. Evidence: supplied test material.";
      yield { type: "block-start", index: 0, blockType: "text" };
      yield { type: "text-delta", index: 0, text };
      yield { type: "block-end", index: 0, block: { type: "text", text } };
      yield { type: "finish", reason: { kind: "stop" } };
    }
  }
  ctx.llm.registerAdapter(["workflow-test"], new FixtureAdapter());
  ctx.directoryPicker.capability = () => ({
    kind: "native",
    pick: async () => config.cwd,
  });
  ctx.connection.fetch.register({
    path: "/api/workflow-fixture",
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      const args = await request.json();
      if (args.action === "calls") return Response.json({ calls });
      if (args.action === 'workspace') return Response.json({workspaces:ctx.workspaceRegistry.list().map(w=>({id:w.id,sessionIds:w.sessionIds})),cwd:config.cwd});
      let agent = ctx.agents.get(args.sessionId);
      if (!agent) {
        const h = await ctx.agents.create({
          sessionId: args.sessionId ?? "workflow-test-session",
          meta: { cwd: config.cwd },
          agentOptions: {
            provider: "workflow-test",
            model: "fixture-root",
            reasoningEffort: "low",
          },
        });
        handles.push(h);
        agent = h.agent;
      }
      if (args.action === "prompt") {
        const content = args.file ? [{type:'file',attachment:await ctx.attachments.admitEncodedFile({name:args.file.name,data:args.file.data})}] : [{type:'text',text:args.text??'Synthetic paper material'}];
        await agent.followup({
          id: crypto.randomUUID(),
          role: "user",
          source: { kind: "user" },
          content,
        });
        await agent.whenIdle();
      }
      if(args.action==='create')await ctx.workspaceRegistry.create(config.cwd,'Workflow verification');
      if(args.action==='tool')return Response.json(await ctx.tools.execute({name:'workflow_studio',arguments:args.arguments,agent,signal:AbortSignal.timeout(60000),callId:crypto.randomUUID()}));
      return Response.json({
        sessionId: agent.session.id,
        events: agent.session
          .snapshotEvents()
          .map((e) => ({
            type: e.type,
            data: e.type === "request/header" ? e.data : undefined,
          })),
      });
    },
  });
  ctx.effect(() => async () => {
    for (const h of handles) await h.dispose();
  });
}
