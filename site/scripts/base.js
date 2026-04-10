document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const auth = window.WallabyAuth;

const getStoredAuthEmail = auth?.getStoredAuthEmail || (() => null);
const setStoredAuthEmail = auth?.setStoredAuthEmail || (() => {});
const fetchAuthEmail = auth?.fetchAuthEmail || (async () => null);
const buildLogoutUrl = auth?.buildLogoutUrl || (() => '/cdn-cgi/access/logout');

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
		logoutLink.href = buildLogoutUrl();
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
