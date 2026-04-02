export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Protected routes go here later, e.g.:
    // if (url.pathname.startsWith('/rsvp')) {
    //   return handleAuth(request, env);
    // }

    return env.ASSETS.fetch(request);
  },
};