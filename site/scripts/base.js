document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const auth = window.WallabyAuth;

const getStoredAuthEmail = auth?.getStoredAuthEmail || (() => null);
const setStoredAuthEmail = auth?.setStoredAuthEmail || (() => {});
const fetchAuthEmail = auth?.fetchAuthEmail || (async () => null);
const FLASH_STORAGE_KEY = 'wallabyfest-flash-message';

const showFlashCard = (message, type) => {
	const card = document.createElement('div');
	card.className = `flash-card flash-card--${type}`;
	card.textContent = message;
	card.setAttribute('role', 'status');
	card.setAttribute('aria-live', 'polite');
	document.body.appendChild(card);

	window.setTimeout(() => {
		card.remove();
	}, 5000);
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

const setSignedOutNav = (detailsLink, profileLink, logoutLink, loginLink) => {
	detailsLink.hidden = true;
	profileLink.hidden = true;
	logoutLink.hidden = true;
	loginLink.hidden = false;
};

const setSignedInNav = (detailsLink, profileLink, logoutLink, loginLink) => {
	detailsLink.hidden = false;
	profileLink.hidden = false;
	logoutLink.hidden = false;
	loginLink.hidden = true;
};

const setupLogout = (logoutLink) => {
	if (!logoutLink) {
		return;
	}

	logoutLink.addEventListener('click', async (event) => {
		event.preventDefault();

		try {
			const logoutUrl = `${window.location.origin}/cdn-cgi/access/logout`;
			const response = await fetch(logoutUrl, {
				method: 'GET',
				credentials: 'same-origin',
			});

			if (response.status === 200) {
				setStoredAuthEmail(null);
				try {
					window.sessionStorage.setItem(FLASH_STORAGE_KEY, 'logout-success');
				} catch {
					// Ignore sessionStorage access failures.
				}
				window.location.assign('/');
				return;
			}

			showFlashCard('Logout failed', 'error');
		} catch {
			showFlashCard('Logout failed', 'error');
		}
	});
};

const initializeAuthNav = async () => {
	const detailsLink = document.getElementById('nav-details-link');
	const profileLink = document.getElementById('nav-profile-link');
	const logoutLink = document.getElementById('nav-logout-link');
	const loginLink = document.getElementById('nav-login-link');

	if (!detailsLink || !profileLink || !logoutLink || !loginLink) {
		return;
	}

	setupLogout(logoutLink);

	const storedEmail = getStoredAuthEmail();

	if (storedEmail) {
		setSignedInNav(detailsLink, profileLink, logoutLink, loginLink);
	} else {
		setSignedOutNav(detailsLink, profileLink, logoutLink, loginLink);
	}

	const identityEmail = await fetchAuthEmail();

	if (identityEmail) {
		setStoredAuthEmail(identityEmail);
		setSignedInNav(detailsLink, profileLink, logoutLink, loginLink);
		return;
	}

	if (storedEmail) {
		setSignedInNav(detailsLink, profileLink, logoutLink, loginLink);
		return;
	}

	setStoredAuthEmail(null);
	setSignedOutNav(detailsLink, profileLink, logoutLink, loginLink);
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		showStoredFlashMessage();
		initializeAuthNav();
	});
} else {
	showStoredFlashMessage();
	initializeAuthNav();
}
