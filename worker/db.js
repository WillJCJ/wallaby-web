import { jsonResponse } from './response.js';
import { HTTP_STATUS } from './constants.js';

export const requireGuestsDb = (env) => {
  if (env.GUESTS_DB) {
    return null;
  }

  return jsonResponse(
    {
      error: 'Guests database is not configured',
      hint: 'Add a D1 binding named GUESTS_DB in wrangler.toml and run migrations.',
    },
    { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
  );
};
