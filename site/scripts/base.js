import { initializeAuthNav } from './features/base/auth-nav.js';
import { FLASH_STORAGE_KEY, showStoredFlashMessage } from './features/base/flash-card.js';
import { showDeploymentVersion } from './features/base/version-label.js';

document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const auth = window.WallabyAuth;

const getStoredAuthEmail = auth?.getStoredAuthEmail || (() => null);
const setStoredAuthEmail = auth?.setStoredAuthEmail || (() => {});
const fetchSignedIn = auth?.fetchSignedIn || (async () => null);
const authStateChangeEvent = auth?.AUTH_STATE_CHANGE_EVENT || 'wallabyauth:statechange';

const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Ignore registration failures so the page shell still boots.
  }
};

const bootstrapBase = () => {
  showDeploymentVersion();
  showStoredFlashMessage();
  void registerServiceWorker();
  initializeAuthNav({
    auth,
    getStoredAuthEmail,
    setStoredAuthEmail,
    fetchSignedIn,
    authStateChangeEvent,
    flashStorageKey: FLASH_STORAGE_KEY,
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapBase);
} else {
  bootstrapBase();
}
