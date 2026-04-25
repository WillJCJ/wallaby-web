document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const auth = window.WallabyAuth;

const getStoredAuthEmail = auth?.getStoredAuthEmail || (() => null);
const setStoredAuthEmail = auth?.setStoredAuthEmail || (() => {});
const fetchAuthEmail = auth?.fetchAuthEmail || (async () => null);
const FLASH_STORAGE_KEY = 'wallabyfest-flash-message';
const PRIVATE_PAGE_PREFIXES = ['/profile/', '/admin/'];

const isPrivatePagePath = (pathname) => PRIVATE_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const buildLoginRedirectUrl = () => {
	const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
	return `/login/?next=${encodeURIComponent(next)}`;
};

const formatLocalTimestamp = (timestamp) => {
	if (!timestamp || typeof timestamp !== 'string') {
		return null;
	}

	const parsed = new Date(timestamp);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}

	const year = String(parsed.getFullYear());
	const month = String(parsed.getMonth() + 1).padStart(2, '0');
	const day = String(parsed.getDate()).padStart(2, '0');
	const hour = String(parsed.getHours()).padStart(2, '0');
	const minute = String(parsed.getMinutes()).padStart(2, '0');

	return `${year}-${month}-${day} ${hour}:${minute}`;
};

const showDeploymentVersion = () => {
	const versionLabel = document.getElementById('footer-version');

	if (!versionLabel) {
		return;
	}

	fetch('/api/env', {
		method: 'GET',
		cache: 'no-store',
		credentials: 'same-origin',
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error('Unable to load environment info');
			}

			return response.json();
		})
		.then((data) => {
			const deploymentId = data?.versionId || data?.deploymentId;
			const hasDeploymentId = typeof deploymentId === 'string' && deploymentId.length > 0;
			const localUpdatedAt = formatLocalTimestamp(data?.versionTimestamp);
			const label = [
				localUpdatedAt ? `Last updated ${localUpdatedAt}` : null,
				hasDeploymentId ? `version ${deploymentId.slice(0, 8)}` : null,
			]
				.filter(Boolean)
				.join(' | ');

			if (label) {
				versionLabel.textContent = label;
				versionLabel.hidden = false;
			}

		})
		.catch(() => {
			// Ignore env info failures to keep footer unobtrusive.
		});
};

const showFlashCard = (message, type) => {
	const card = document.createElement('div');
	card.className = `flash-card flash-card--${type}`;
	card.textContent = message;
	card.setAttribute('role', 'status');
	card.setAttribute('aria-live', 'polite');

	let removed = false;
	const removeCard = () => {
		if (removed) {
			return;
		}

		removed = true;
		card.remove();
	};

	const header = document.querySelector('header');
	if (header) {
		const headerOffset = Math.max(8, Math.round(header.getBoundingClientRect().height + 8));
		card.style.setProperty('--flash-card-top', `${headerOffset}px`);
	}

	document.body.appendChild(card);

	card.addEventListener('transitionend', (event) => {
		if (event.target === card && event.propertyName === 'opacity') {
			removeCard();
		}
	});

	window.setTimeout(() => {
		card.classList.add('flash-card--hidden');
		window.setTimeout(removeCard, 1000);
	}, 4500);
};

const showStoredFlashMessage = () => {
	try {
		const flashMessage = window.sessionStorage.getItem(FLASH_STORAGE_KEY);
		if (!flashMessage) {
			return;
		}

		window.sessionStorage.removeItem(FLASH_STORAGE_KEY);
		if (flashMessage === 'logout-success') {
			showFlashCard('Logout successful', 'success');
		}
	} catch {
		// Ignore sessionStorage access failures.
	}
};

const setSignedOutNav = (profileLink, logoutLink, loginLink) => {
	profileLink.hidden = true;
	logoutLink.hidden = true;
	loginLink.hidden = false;
};

const setSignedInNav = (profileLink, logoutLink, loginLink) => {
	profileLink.hidden = false;
	logoutLink.hidden = false;
	loginLink.hidden = true;
};

const setupLogout = (logoutLink) => {
	if (!logoutLink) {
		return;
	}

	const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

	if (isLocalHost) {
		logoutLink.href = '#';
		logoutLink.addEventListener('click', async (event) => {
			event.preventDefault();

			try {
				await auth?.devLogout?.();
			} catch {
				// Ignore logout failures and still clear local state.
			}

			setStoredAuthEmail(null);
			try {
				window.sessionStorage.setItem(FLASH_STORAGE_KEY, 'logout-success');
			} catch {
				// Ignore sessionStorage access failures.
			}

			window.location.replace('/');
		});

		return;
	}

	const logoutUrl = new URL('/cdn-cgi/access/logout', window.location.origin);
	logoutUrl.searchParams.set('returnTo', `${window.location.origin}/`);
	logoutLink.href = logoutUrl.toString();

	logoutLink.addEventListener('click', () => {
		setStoredAuthEmail(null);
		try {
			window.sessionStorage.setItem(FLASH_STORAGE_KEY, 'logout-success');
		} catch {
			// Ignore sessionStorage access failures.
		}
	});
};

const initializeAuthNav = async () => {
	const profileLink = document.getElementById('nav-profile-link');
	const logoutLink = document.getElementById('nav-logout-link');
	const loginLink = document.getElementById('nav-login-link');

	if (!profileLink || !logoutLink || !loginLink) {
		return;
	}

	setupLogout(logoutLink);

	const isPrivatePage = isPrivatePagePath(window.location.pathname);
	const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

	const storedEmail = getStoredAuthEmail();

	if (storedEmail) {
		setSignedInNav(profileLink, logoutLink, loginLink);
	} else {
		setSignedOutNav(profileLink, logoutLink, loginLink);
	}

	const identityEmail = await fetchAuthEmail();

	if (identityEmail) {
		setStoredAuthEmail(identityEmail);
		setSignedInNav(profileLink, logoutLink, loginLink);
		return;
	}

	if (isPrivatePage && !isLocalHost) {
		setStoredAuthEmail(null);
		setSignedOutNav(profileLink, logoutLink, loginLink);
		window.location.replace(buildLoginRedirectUrl());
		return;
	}

	if (storedEmail) {
		setSignedInNav(profileLink, logoutLink, loginLink);
		return;
	}

	setStoredAuthEmail(null);
	setSignedOutNav(profileLink, logoutLink, loginLink);
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		showDeploymentVersion();
		showStoredFlashMessage();
		initializeAuthNav();
	});
} else {
	showDeploymentVersion();
	showStoredFlashMessage();
	initializeAuthNav();
}
