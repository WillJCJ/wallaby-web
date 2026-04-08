import { handlePrivateDetails } from './details.js';
import { handleGuestsApi } from './guests.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/private/details') {
      return handlePrivateDetails(request, env);
    }

    if (url.pathname === '/api/private/guests' || url.pathname.startsWith('/api/private/guests/')) {
      return handleGuestsApi(request, env, url.pathname);
    }

    return env.ASSETS.fetch(request);
  },
};
