interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const functionModules = import.meta.glob<{
  default: (req: Request) => Promise<Response>;
}>('./functions/*.js', { eager: true });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/__monoserve/')) {
      const functionName = url.pathname.slice('/__monoserve/'.length);
      const module = functionModules[`./functions/${functionName}.js`];

      if (module) {
        try {
          const handler = module.default;
          return await handler(request);
        } catch (error) {
          console.error(`Error executing ${functionName}:`, error);
          return new Response('Internal Server Error', { status: 500 });
        }
      }
    }

    return env.ASSETS.fetch(request);
  },
};
