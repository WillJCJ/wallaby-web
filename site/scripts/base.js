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

const setSignedOutNav = (detailsLink, accountLink) => {
	detailsLink.hidden = true;
	accountLink.href = '/login/';
	accountLink.classList.remove('is-authenticated');
	accountLink.removeAttribute('data-tooltip');
	accountLink.title = '';
	accountLink.setAttribute('aria-label', 'Login');
	accountLink.textContent = 'Login';
};

const setSignedInNav = (detailsLink, accountLink, email) => {
	detailsLink.hidden = false;
	accountLink.removeAttribute('href');
	accountLink.classList.add('is-authenticated');
	accountLink.setAttribute('data-tooltip', `Signed in as ${email}`);
	accountLink.title = '';
	accountLink.setAttribute('aria-label', `Signed in as ${email}`);
	accountLink.innerHTML = '<span class="nav-profile-avatar" aria-hidden="true"></span><span class="sr-only">Signed in account status</span>';
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

const initializeAuthNav = async () => {
	const detailsLink = document.getElementById('nav-details-link');
	const accountLink = document.getElementById('nav-account-link');

	if (!detailsLink || !accountLink) {
		return;
	}

	 const storedEmail = getStoredAuthEmail();

	if (storedEmail) {
		setSignedInNav(detailsLink, accountLink, storedEmail);
	} else {
		setSignedOutNav(detailsLink, accountLink);
	}

	const email = await fetchAuthEmail();

	if (email) {
		setStoredAuthEmail(email);
		setSignedInNav(detailsLink, accountLink, email);
		return;
	}

	setStoredAuthEmail(null);
	setSignedOutNav(detailsLink, accountLink);
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		initializeAuthNav();
	});
} else {
	initializeAuthNav();
}
