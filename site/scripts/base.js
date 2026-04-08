document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const AUTH_EMAIL_STORAGE_KEY = 'wallabyfest-auth-email';

const getStoredAuthEmail = () => {
	try {
		return window.localStorage.getItem(AUTH_EMAIL_STORAGE_KEY);
	} catch {
		return null;
	}
};

const setStoredAuthEmail = (email) => {
	try {
		if (email) {
			window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, email);
			return;
		}

		window.localStorage.removeItem(AUTH_EMAIL_STORAGE_KEY);
	} catch {
		// Ignore storage access failures.
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

const fetchAuthEmail = async () => {
	try {
		const response = await fetch('/cdn-cgi/access/get-identity', {
			credentials: 'same-origin',
			headers: {
				accept: 'application/json',
			},
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json().catch(() => null);
		const email = data?.email || data?.user_email || data?.identity?.email || null;
		return typeof email === 'string' && email ? email : null;
	} catch {
		return null;
	}
};

const fetchGuestEmail = async () => {
	try {
		const response = await fetch('/api/private/guests/me', {
			method: 'GET',
			credentials: 'same-origin',
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json().catch(() => null);
		const email = data?.guest?.email || null;
		return typeof email === 'string' && email ? email : null;
	} catch {
		return null;
	}
};

const initializeAuthNav = async () => {
	const detailsLink = document.getElementById('nav-details-link');
	const profileLink = document.getElementById('nav-profile-link');
	const logoutLink = document.getElementById('nav-logout-link');
	const loginLink = document.getElementById('nav-login-link');

	if (!detailsLink || !profileLink || !logoutLink || !loginLink) {
		return;
	}

	const storedEmail = getStoredAuthEmail();

	if (logoutLink) {
		logoutLink.addEventListener('click', () => {
			setStoredAuthEmail(null);
		});
	}

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

	const guestEmail = await fetchGuestEmail();

	if (guestEmail) {
		setStoredAuthEmail(guestEmail);
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
		initializeAuthNav();
	});
} else {
	initializeAuthNav();
}
