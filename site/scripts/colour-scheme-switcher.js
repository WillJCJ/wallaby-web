/**
 * Colour Scheme Switcher for Wallaby Fest
 * Click the brand (logo + title) to cycle through colour schemes
 * Click the footer label to pick a specific scheme
 */

const COLOUR_SCHEMES = [
  'wallaby-brown',
  'warm-sunset',
  'cool-teal',
  'forest-green',
  'ocean-blue',
  'minimalist',
  'berry',
  'coral',
  'muted-earth',
  'midnight',
  'vibrant-pop',
];

const STORAGE_KEY = 'wallabyfest-colour-scheme';
const DEFAULT_SCHEME = 'minimalist';

/**
 * Initialize colour scheme switcher
 * Loads saved scheme or uses default, and sets up logo click handler
 */
function initializeColourScheme() {
  // Load saved scheme or use default
  const savedScheme = localStorage.getItem(STORAGE_KEY) || DEFAULT_SCHEME;
  applyColourScheme(savedScheme);

  // Bind click to the logo button to cycle the colour scheme
  const brand = document.querySelector('.site-brand--interactive');
  if (brand) {
    brand.addEventListener('click', () => {
      cycleColourScheme();
    });
    brand.setAttribute('title', 'Click to change colour scheme');
  }

  // Populate footer picker list
  const list = document.getElementById('colour-scheme-list');
  if (list) {
    COLOUR_SCHEMES.forEach((scheme) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.scheme = scheme;
      btn.textContent = schemeDisplayName(scheme);
      btn.addEventListener('click', () => {
        applyColourScheme(scheme);
        document.getElementById('colour-scheme-picker').removeAttribute('open');
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }
}

/**
 * Format a scheme id as a display name
 * @param {string} scheme
 * @returns {string}
 */
function schemeDisplayName(scheme) {
  return scheme
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Apply a colour scheme to the page
 */
function applyColourScheme(scheme) {
  if (!COLOUR_SCHEMES.includes(scheme)) {
    scheme = DEFAULT_SCHEME;
  }

  // Set the data attribute on root element
  document.documentElement.setAttribute('data-colour-scheme', scheme);

  // Save to localStorage
  localStorage.setItem(STORAGE_KEY, scheme);

  // Update footer label
  updateFooterLabel(scheme);
}

/**
 * Update the footer with the active colour scheme name
 * @param {string} scheme - The active colour scheme name
 */
function updateFooterLabel(scheme) {
  const el = document.getElementById('footer-colour-scheme');
  if (!el) return;
  el.textContent = schemeDisplayName(scheme);

  // Mark active item in picker list
  const list = document.getElementById('colour-scheme-list');
  if (list) {
    list.querySelectorAll('button').forEach((btn) => {
      btn.setAttribute('aria-current', btn.dataset.scheme === scheme ? 'true' : 'false');
    });
  }
}

/**
 * Cycle to the next colour scheme
 */
function cycleColourScheme() {
  const currentScheme = document.documentElement.getAttribute('data-colour-scheme') || DEFAULT_SCHEME;
  const currentIndex = COLOUR_SCHEMES.indexOf(currentScheme);
  const nextIndex = (currentIndex + 1) % COLOUR_SCHEMES.length;
  const nextScheme = COLOUR_SCHEMES[nextIndex];

  applyColourScheme(nextScheme);

  // Optional: Show visual feedback
  showSchemeChangeNotification(nextScheme);
}

/**
 * Show a brief notification when scheme changes
 * @param {string} scheme - The new colour scheme name
 */
function showSchemeChangeNotification(scheme) {
  const displayName = schemeDisplayName(scheme);

  const header = document.querySelector('header');
  const topOffset = header ? (header.offsetHeight + 8) : 80;

  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'colour-scheme-notification';
  notification.textContent = `Colour scheme: ${displayName}`;
  notification.style.cssText = `
    position: fixed;
    top: ${topOffset}px;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.75rem 1.5rem;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 6px;
    font-size: 0.875rem;
    pointer-events: none;
    z-index: 1000;
    animation: fadeInOut 4s ease-out;
  `;

  // Add animation styles if not already present
  if (!document.querySelector('style[data-colour-scheme-animation]')) {
    const style = document.createElement('style');
    style.setAttribute('data-colour-scheme-animation', '');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        5% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Remove notification after animation
  setTimeout(() => notification.remove(), 4000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeColourScheme);
} else {
  initializeColourScheme();
}
