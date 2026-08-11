/**
 * Cheap, dependency-free visitor language detection.
 *
 * Runs on every visitor turn so live chats carry a language marker without an
 * extra LLM call. Escalations still refine this with the LLM handoff brief.
 */

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  hi: 'Hindi',
  bn: 'Bengali',
  ru: 'Russian',
  tr: 'Turkish',
  pl: 'Polish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  el: 'Greek',
  he: 'Hebrew',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  ro: 'Romanian',
  hu: 'Hungarian',
  fa: 'Persian',
  ur: 'Urdu',
  ta: 'Tamil',
  ms: 'Malay',
};

export function languageName(code: string | null | undefined): string {
  if (!code?.trim()) return 'Unknown';
  const base = code.trim().toLowerCase().slice(0, 2);
  return LANGUAGE_NAMES[base] ?? code.trim().toUpperCase();
}

/** Scripts are decisive: a single match outranks any Latin word scoring. */
const SCRIPTS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'bn', pattern: /[\u0980-\u09FF]/ },
  { code: 'hi', pattern: /[\u0900-\u097F]/ },
  { code: 'ta', pattern: /[\u0B80-\u0BFF]/ },
  { code: 'th', pattern: /[\u0E00-\u0E7F]/ },
  { code: 'he', pattern: /[\u0590-\u05FF]/ },
  { code: 'el', pattern: /[\u0370-\u03FF]/ },
  { code: 'ko', pattern: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
  { code: 'ja', pattern: /[\u3040-\u30FF]/ },
  { code: 'zh', pattern: /[\u4E00-\u9FFF]/ },
  { code: 'ru', pattern: /[\u0400-\u04FF]/ },
  { code: 'ar', pattern: /[\u0600-\u06FF]/ },
];

/** Distinctive words per language; scored by how many hits a sample produces. */
const WORDS: Record<string, string[]> = {
  en: [
    'the', 'and', 'you', 'hello', 'hi', 'please', 'thanks', 'thank', 'what', 'where',
    'when', 'how', 'can', 'could', 'would', 'my', 'order', 'help', 'about', 'need',
    'want', 'is', 'are', 'registration', 'conference',
  ],
  fr: [
    'bonjour', 'salut', 'merci', 'oui', 'non', 'quoi', 'quel', 'quelle', 'comment',
    'pouvez', 'pourriez', 'voudrais', 'aujourd', 'demain', 'je', 'vous', 'nous',
    'est', 'les', 'des', 'une', 'pour', 'avec', 'mais', 'aussi', 'plait', 'commande',
    'inscription', 'conférence', 'rôle',
  ],
  es: [
    'hola', 'gracias', 'por favor', 'buenos', 'buenas', 'quiero', 'necesito', 'donde',
    'cuando', 'como', 'que', 'los', 'las', 'una', 'para', 'con', 'pero', 'también',
    'usted', 'pedido', 'asistente', 'ayuda', 'conferencia',
  ],
  pt: [
    'olá', 'obrigado', 'obrigada', 'por favor', 'bom dia', 'boa tarde', 'você',
    'quero', 'preciso', 'onde', 'quando', 'como', 'não', 'sim', 'para', 'com',
    'pedido', 'ajuda', 'conferência',
  ],
  de: [
    'hallo', 'guten', 'danke', 'bitte', 'ich', 'sie', 'wir', 'nicht', 'und', 'oder',
    'wie', 'was', 'wo', 'wann', 'kann', 'könnte', 'möchte', 'bestellung', 'hilfe',
    'konferenz',
  ],
  it: [
    'ciao', 'grazie', 'per favore', 'buongiorno', 'buonasera', 'sono', 'vorrei',
    'come', 'dove', 'quando', 'che', 'non', 'anche', 'ordine', 'aiuto', 'conferenza',
  ],
  nl: [
    'hallo', 'bedankt', 'alstublieft', 'graag', 'ik', 'wij', 'niet', 'hoe', 'waar',
    'wanneer', 'kunt', 'wil', 'bestelling', 'hulp',
  ],
  tr: [
    'merhaba', 'teşekkür', 'lütfen', 'nasıl', 'nerede', 'ne zaman', 'istiyorum',
    'yardım', 'sipariş', 'evet', 'hayır',
  ],
  pl: [
    'cześć', 'dzień dobry', 'dziękuję', 'proszę', 'jak', 'gdzie', 'kiedy', 'chcę',
    'pomoc', 'zamówienie', 'nie', 'tak',
  ],
  vi: [
    'xin chào', 'cảm ơn', 'vui lòng', 'tôi', 'bạn', 'không', 'được', 'giúp',
    'đơn hàng', 'thế nào',
  ],
  id: [
    'halo', 'terima kasih', 'tolong', 'saya', 'anda', 'tidak', 'bagaimana', 'dimana',
    'bantuan', 'pesanan',
  ],
};

/**
 * Distinctive greetings that settle a language on their own, so a first message
 * of just "Bonjour" already marks the thread as French.
 */
const STRONG_MARKERS: Array<{ code: string; words: string[]; weight: number }> = [
  { code: 'fr', words: ['bonjour', 'bonsoir', 'salut', 'merci', 's’il vous plaît', "s'il vous plaît"], weight: 3 },
  { code: 'es', words: ['hola', 'gracias', 'buenos días', 'buenas tardes'], weight: 3 },
  { code: 'pt', words: ['olá', 'obrigado', 'obrigada', 'bom dia'], weight: 3 },
  { code: 'it', words: ['ciao', 'grazie', 'buongiorno', 'buonasera'], weight: 3 },
  { code: 'de', words: ['hallo', 'guten tag', 'guten morgen', 'danke'], weight: 2 },
  { code: 'nl', words: ['hallo', 'bedankt', 'goedemorgen'], weight: 1 },
  { code: 'tr', words: ['merhaba', 'teşekkürler'], weight: 3 },
  { code: 'pl', words: ['cześć', 'dzień dobry', 'dziękuję'], weight: 3 },
  { code: 'vi', words: ['xin chào', 'cảm ơn'], weight: 3 },
  { code: 'id', words: ['halo', 'terima kasih'], weight: 3 },
];

/** Diacritic fingerprints add weight for short samples like "Bonjour". */
const DIACRITICS: Array<{ code: string; pattern: RegExp; weight: number }> = [
  { code: 'fr', pattern: /[àâäéèêëïîôùûüçœæ]/, weight: 2 },
  { code: 'es', pattern: /[¿¡ñ]/, weight: 3 },
  { code: 'es', pattern: /[áíóú]/, weight: 1 },
  { code: 'pt', pattern: /[ãõç]/, weight: 3 },
  { code: 'de', pattern: /[äöüß]/, weight: 2 },
  { code: 'it', pattern: /[àèìòù]/, weight: 1 },
  { code: 'tr', pattern: /[ğşıİçö]/, weight: 2 },
  { code: 'pl', pattern: /[ąćęłńśźż]/, weight: 3 },
  { code: 'vi', pattern: /[ăâđêôơư]/, weight: 3 },
];

export interface LanguageGuess {
  language: string;
  languageName: string;
  /** Only confident guesses should overwrite a stored language. */
  confident: boolean;
}

function countWordHits(sample: string, words: string[]): number {
  let hits = 0;
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \b is unreliable next to accented characters, so guard with separators.
    const re = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'giu');
    const matches = sample.match(re);
    if (matches) hits += matches.length;
  }
  return hits;
}

/** Detect the dominant language of visitor text. */
export function detectLanguage(texts: Array<string | null | undefined>): LanguageGuess {
  const sample = texts
    .filter((t): t is string => Boolean(t?.trim()))
    .join('\n')
    .toLowerCase()
    .slice(0, 2000);

  if (!sample.trim()) {
    return { language: 'en', languageName: 'English', confident: false };
  }

  for (const { code, pattern } of SCRIPTS) {
    if (pattern.test(sample)) {
      return { language: code, languageName: languageName(code), confident: true };
    }
  }

  const scores = new Map<string, number>();
  for (const [code, words] of Object.entries(WORDS)) {
    const hits = countWordHits(sample, words);
    if (hits > 0) scores.set(code, hits);
  }
  for (const { code, pattern, weight } of DIACRITICS) {
    if (pattern.test(sample)) {
      scores.set(code, (scores.get(code) ?? 0) + weight);
    }
  }
  for (const { code, words, weight } of STRONG_MARKERS) {
    if (countWordHits(sample, words) > 0) {
      scores.set(code, (scores.get(code) ?? 0) + weight);
    }
  }

  let best = 'en';
  let bestScore = 0;
  let runnerUp = 0;
  for (const [code, score] of scores) {
    if (score > bestScore) {
      runnerUp = bestScore;
      best = code;
      bestScore = score;
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  // Require a clear winner: enough evidence and a margin over the next language.
  const confident = bestScore >= 2 && bestScore > runnerUp;
  return {
    language: confident ? best : 'en',
    languageName: languageName(confident ? best : 'en'),
    confident,
  };
}
