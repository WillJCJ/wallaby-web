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

const bootstrapBase = () => {
  showDeploymentVersion();
  showStoredFlashMessage();
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
