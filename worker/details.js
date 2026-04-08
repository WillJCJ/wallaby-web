import { HTTP_STATUS } from './constants.js';
import { requireAuthenticatedEmail } from './auth.js';
import { jsonResponse } from './response.js';

export const handlePrivateDetails = (request, env) => {
  if (request.method !== 'GET') {
    return jsonResponse(
      { error: 'Method Not Allowed' },
      { status: HTTP_STATUS.METHOD_NOT_ALLOWED }
    );
  }

  const authResult = requireAuthenticatedEmail(request);

  if (authResult.error) {
    return authResult.error;
  }

  return jsonResponse(
    {
      address: env.EVENT_ADDRESS || '62 West Wallaby Street, Wigan, Lancashire, WA11 4BY',
      gateCode: env.GATE_CODE || '1234',
      viewer: authResult.email,
    },
    {
      headers: {
        'cache-control': 'private, no-store',
      },
    }
  );
};
