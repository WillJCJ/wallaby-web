// Polyfill crypto.subtle.timingSafeEqual for Node.js test environments.
// The real API exists in Cloudflare Workers but not in Node.js, so vitest
// needs this shim to exercise the worker auth code path.

if (globalThis.crypto?.subtle && !crypto.subtle.timingSafeEqual) {
  crypto.subtle.timingSafeEqual = (a, b) => {
    if (a.byteLength !== b.byteLength) {
      return false;
    }
    const viewA = new Uint8Array(a);
    const viewB = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < viewA.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- index is a loop counter, not user input
      diff |= viewA[i] ^ viewB[i];
    }
    return diff === 0;
  };
}
