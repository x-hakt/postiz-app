// x-hakt: this instance is Australian. US formats (month first, AM/PM) only when chosen in
// Settings > Date Metrics; a browser left on US English no longer switches them on.
export const isUSCitizen = () => {
  try {
    return localStorage.getItem('isUS') === 'US';
  } catch {
    return false;
  }
};

// dayjs locale for the UI language: English dates read Australian (DD/MM/YYYY, weeks from Monday).
export const dayjsLocale = (language: string) => (language === 'en' && !isUSCitizen() ? 'en-au' : language);
