// x-hakt: this instance is Australian: day-first dates and 12-hour times. US formats (month
// first) only when chosen in Settings > Date Metrics; a US-English browser no longer switches them on.
export const isUSCitizen = () => {
  try {
    return localStorage.getItem('isUS') === 'US';
  } catch {
    return false;
  }
};

// dayjs locale for the UI language: English dates read Australian (DD/MM/YYYY, weeks from Monday).
export const dayjsLocale = (language: string) => (language === 'en' && !isUSCitizen() ? 'en-au' : language);
