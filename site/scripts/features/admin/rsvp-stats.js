export const renderRsvpStats = (guests, ui) => {
  const {
    rsvpStats,
    rsvpTotal,
    rsvpBar,
    rsvpYes,
    rsvpPending,
    rsvpNo,
  } = ui;

  if (!Array.isArray(guests) || guests.length === 0) {
    rsvpStats.hidden = true;
    return;
  }

  const counts = { yes: 0, no: 0, pending: 0 };
  let totalGuests = 0;
  guests.forEach((g) => {
    const extra = Number.parseInt(g.additionalGuests, 10) || 0;
    const headcount = 1 + extra;
    totalGuests += headcount;
    const rsvp = (g.rsvp || 'pending').toLowerCase();
    if (rsvp === 'yes') counts.yes += headcount;
    else if (rsvp === 'no') counts.no += headcount;
    else counts.pending += headcount;
  });
  const total = counts.yes + counts.no + counts.pending;

  rsvpTotal.textContent = `${totalGuests} total guest${totalGuests === 1 ? '' : 's'}`;

  const getCountForLabel = (label) => {
    if (label === 'yes') return counts.yes;
    if (label === 'pending') return counts.pending;
    if (label === 'no') return counts.no;
    return 0;
  };

  const segments = [
    ['yes', rsvpYes],
    ['pending', rsvpPending],
    ['no', rsvpNo],
  ];

  segments.forEach(([label, element]) => {
    const count = getCountForLabel(label);
    element.hidden = count === 0;
    if (count > 0) {
      element.style.flexBasis = `${Math.round((count / Math.max(total, 1)) * 100)}%`;
      element.title = `${label.charAt(0).toUpperCase() + label.slice(1)}: ${count}`;
      element.textContent = String(count);
    } else {
      element.style.flexBasis = '0%';
      element.title = '';
      element.textContent = '';
    }
  });

  rsvpBar.hidden = total === 0;
  rsvpStats.hidden = false;
};
