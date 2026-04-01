export default {
  async fetch(request, env, ctx) {
    return new Response("Hello from wallabyfest.co.uk!", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
