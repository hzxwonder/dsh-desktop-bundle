import {createRequire} from 'node:module';
const require = createRequire(new URL('../../../runtime/package.json', import.meta.url));
const {LlmAdapter} = await import(require.resolve('@deepseek-ai/dsh-llm'));
export const inject = ['llm', 'connection', 'agents', 'sessions', 'sessionController', 'sessionReferenceResolver', 'workspaceRegistry'];
export function apply(ctx) {
  const calls = [];
  class FixtureAdapter extends LlmAdapter {
    async listModels(provider) {return [{provider, id: 'fixture', name: 'Session verification'}];}
    async resolveModel(provider, id) {return {provider, id, name: 'Session verification', contextWindow: 32768};}
    async *stream(options) {
      calls.push(JSON.stringify(options.messages));
      const text = 'Synthetic reference verification completed.';
      yield {type:'block-start', index:0, blockType:'text'};
      yield {type:'text-delta', index:0, text};
      yield {type:'block-end', index:0, block:{type:'text',text}};
      yield {type:'finish', reason:{kind:'stop'}};
    }
  }
  ctx.llm.registerAdapter(['session-test'], new FixtureAdapter());
  ctx.connection.fetch.register({path:'/api/session-fixture', methods:['POST'], requestBody:'buffered', async fetch(request) {
    try {
      const args = await request.json();
      const projects = () => ctx.workspaceRegistry.list().map(workspace => ({id: workspace.id, path: workspace.path, title: workspace.title, sessionIds: [...workspace.sessionIds]}));
      if (args.action === 'status') return Response.json({workspaces: projects(), calls});
      if (args.action === 'create') {
        const created = await ctx.sessionController.create({sessionId: args.sessionId, workspaceId: args.workspaceId, cwd: args.cwd});
        const session = ctx.sessions.get(created.sessionId);
        return Response.json({sessionId: created.sessionId, cwd: session?.header.cwd});
      }
      if (args.action === 'addWorkspace') return Response.json({workspace: await ctx.workspaceRegistry.create(args.path, args.title)});
      if (args.action === 'inspect') {
        const value = await ctx.sessionController.inspect(args.sessionId, request.signal);
        return Response.json(value);
      }
      await ctx.sessionController.selectModel({sessionId:args.sessionId, provider:'session-test', model:'fixture'});
      const {agent} = await ctx.sessionController.resolveAgent(args.sessionId);
      if (args.action === 'prompt') {
        await agent.followup({id:crypto.randomUUID(), role:'user', source:{kind:'user'}, content:[{type:'text', text:args.text}]});
        await agent.whenIdle();
        await ctx.sessions.flush(agent.session);
        return Response.json({calls, events:agent.session.snapshotEvents()});
      }
      if (args.action === 'archive') {
        await ctx.workspaceRegistry.archiveSession(args.sessionId);
        return Response.json({archived:true});
      }
      if (args.action === 'fork') return Response.json(await ctx.sessionController.fork({sessionId:args.sessionId}));
      return Response.json({error:'UNKNOWN_ACTION'}, {status:400});
    } catch (error) {return Response.json({error:error.message}, {status:500});}
  }});
}
