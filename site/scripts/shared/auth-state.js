export const getAuth = () => window.WallabyAuth || null;

export const clearStoredAuthEmail = () => {
  window.WallabyAuth?.setStoredAuthEmail?.(null);
};

export const setStoredAuthEmail = (email) => {
  window.WallabyAuth?.setStoredAuthEmail?.(email);
};
