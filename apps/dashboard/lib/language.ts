/** Flag + name per ISO-639-1 code, for language markers in the agent UI. */
const LANGUAGES: Record<string, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇬🇧' },
  fr: { name: 'French', flag: '🇫🇷' },
  es: { name: 'Spanish', flag: '🇪🇸' },
  de: { name: 'German', flag: '🇩🇪' },
  it: { name: 'Italian', flag: '🇮🇹' },
  pt: { name: 'Portuguese', flag: '🇵🇹' },
  nl: { name: 'Dutch', flag: '🇳🇱' },
  ar: { name: 'Arabic', flag: '🇸🇦' },
  zh: { name: 'Chinese', flag: '🇨🇳' },
  ja: { name: 'Japanese', flag: '🇯🇵' },
  ko: { name: 'Korean', flag: '🇰🇷' },
  hi: { name: 'Hindi', flag: '🇮🇳' },
  bn: { name: 'Bengali', flag: '🇧🇩' },
  ru: { name: 'Russian', flag: '🇷🇺' },
  tr: { name: 'Turkish', flag: '🇹🇷' },
  pl: { name: 'Polish', flag: '🇵🇱' },
  uk: { name: 'Ukrainian', flag: '🇺🇦' },
  vi: { name: 'Vietnamese', flag: '🇻🇳' },
  th: { name: 'Thai', flag: '🇹🇭' },
  id: { name: 'Indonesian', flag: '🇮🇩' },
  el: { name: 'Greek', flag: '🇬🇷' },
  he: { name: 'Hebrew', flag: '🇮🇱' },
  sv: { name: 'Swedish', flag: '🇸🇪' },
  da: { name: 'Danish', flag: '🇩🇰' },
  no: { name: 'Norwegian', flag: '🇳🇴' },
  fi: { name: 'Finnish', flag: '🇫🇮' },
  cs: { name: 'Czech', flag: '🇨🇿' },
  ro: { name: 'Romanian', flag: '🇷🇴' },
  hu: { name: 'Hungarian', flag: '🇭🇺' },
  fa: { name: 'Persian', flag: '🇮🇷' },
  ur: { name: 'Urdu', flag: '🇵🇰' },
  ta: { name: 'Tamil', flag: '🇮🇳' },
  ms: { name: 'Malay', flag: '🇲🇾' },
};

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
  isEnglish: boolean;
}

/** Resolve a stored `detected_language` value to display data. */
export function languageInfo(code: string | null | undefined): LanguageInfo | null {
  const raw = code?.trim().toLowerCase();
  if (!raw) return null;
  const base = raw.slice(0, 2);
  const known = LANGUAGES[base];
  return {
    code: base.toUpperCase(),
    name: known?.name ?? raw.toUpperCase(),
    flag: known?.flag ?? '🌐',
    isEnglish: base === 'en',
  };
}
