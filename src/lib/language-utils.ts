/**
 * Language Detection and Font Mapping Utilities
 * 
 * Uses franc-min for language detection and provides
 * appropriate font stacks for different scripts.
 * 
 * @version 1.0.0
 */

import { franc } from 'franc-min';
import { typography } from './design-tokens';

// =============================================================================
// TYPES
// =============================================================================

export type LanguageCode = 
  | 'en' | 'ja' | 'zh' | 'ko' | 'ar' | 'he' | 'th' | 'hi'
  | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'it' | 'nl' | 'pl'
  | 'und' // undefined/unknown
  | string;

export type ScriptType = 
  | 'latin' 
  | 'japanese' 
  | 'chinese' 
  | 'korean' 
  | 'arabic' 
  | 'hebrew' 
  | 'thai' 
  | 'devanagari'
  | 'cyrillic';

export type TextDirection = 'ltr' | 'rtl';

export interface LanguageInfo {
  code: LanguageCode;
  script: ScriptType;
  direction: TextDirection;
  fontFamily: string;
}

// =============================================================================
// MAPPINGS
// =============================================================================

/**
 * Map ISO 639-3 codes (franc output) to simplified codes
 */
const isoCodeMap: Record<string, LanguageCode> = {
  'eng': 'en',
  'jpn': 'ja',
  'cmn': 'zh', // Mandarin Chinese
  'zho': 'zh', // Chinese
  'kor': 'ko',
  'ara': 'ar',
  'heb': 'he',
  'tha': 'th',
  'hin': 'hi',
  'spa': 'es',
  'fra': 'fr',
  'deu': 'de',
  'por': 'pt',
  'rus': 'ru',
  'ita': 'it',
  'nld': 'nl',
  'pol': 'pl',
  'und': 'und',
};

/**
 * Map language codes to script types
 */
const languageToScript: Record<string, ScriptType> = {
  'en': 'latin',
  'es': 'latin',
  'fr': 'latin',
  'de': 'latin',
  'pt': 'latin',
  'it': 'latin',
  'nl': 'latin',
  'pl': 'latin',
  'ja': 'japanese',
  'zh': 'chinese',
  'ko': 'korean',
  'ar': 'arabic',
  'he': 'hebrew',
  'th': 'thai',
  'hi': 'devanagari',
  'ru': 'cyrillic',
};

/**
 * Scripts that use right-to-left text direction
 */
const rtlScripts: Set<ScriptType> = new Set(['arabic', 'hebrew']);

/**
 * Map script types to font families
 */
const scriptToFont: Record<ScriptType, string> = {
  latin: typography.fonts.body,
  japanese: typography.fonts.japanese,
  chinese: typography.fonts.chinese,
  korean: typography.fonts.korean,
  arabic: typography.fonts.arabic,
  hebrew: typography.fonts.hebrew,
  thai: typography.fonts.thai,
  devanagari: typography.fonts.devanagari,
  cyrillic: typography.fonts.body, // Cyrillic uses same fonts as Latin
};

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Detect the language of a text string
 * 
 * @param text - The text to analyze
 * @returns Language code (ISO 639-1 style, e.g., 'en', 'ja')
 */
export function detectLanguage(text: string): LanguageCode {
  if (!text || text.trim().length < 10) {
    return 'und'; // Need minimum text for detection
  }
  
  const detected = franc(text);
  return isoCodeMap[detected] || detected || 'und';
}

/**
 * Get the script type for a language code
 */
export function getScriptType(languageCode: LanguageCode): ScriptType {
  return languageToScript[languageCode] || 'latin';
}

/**
 * Get text direction for a language/script
 */
export function getTextDirection(languageCode: LanguageCode): TextDirection {
  const script = getScriptType(languageCode);
  return rtlScripts.has(script) ? 'rtl' : 'ltr';
}

/**
 * Get the appropriate font family for a language
 */
export function getFontFamily(languageCode: LanguageCode): string {
  const script = getScriptType(languageCode);
  return scriptToFont[script];
}

/**
 * Get complete language information for text
 */
export function getLanguageInfo(text: string): LanguageInfo {
  const code = detectLanguage(text);
  const script = getScriptType(code);
  
  return {
    code,
    script,
    direction: getTextDirection(code),
    fontFamily: getFontFamily(code),
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if text contains primarily RTL characters
 */
export function isRTL(text: string): boolean {
  const info = getLanguageInfo(text);
  return info.direction === 'rtl';
}

/**
 * Create CSS styles object for text rendering
 */
export function getTextStyles(text: string): {
  fontFamily: string;
  direction: TextDirection;
  textAlign: 'left' | 'right';
} {
  const info = getLanguageInfo(text);
  
  return {
    fontFamily: info.fontFamily,
    direction: info.direction,
    textAlign: info.direction === 'rtl' ? 'right' : 'left',
  };
}

/**
 * Detect language from first message in a conversation
 * Falls back to 'en' if detection fails
 */
export function detectConversationLanguage(messages: { content: string }[]): LanguageCode {
  if (!messages || messages.length === 0) {
    return 'en';
  }
  
  // Combine first few messages for better detection
  const sampleText = messages
    .slice(0, 3)
    .map(m => m.content)
    .join(' ')
    .slice(0, 500);
  
  const detected = detectLanguage(sampleText);
  return detected === 'und' ? 'en' : detected;
}

// =============================================================================
// EXPORTS
// =============================================================================

const languageUtils = {
  detectLanguage,
  getScriptType,
  getTextDirection,
  getFontFamily,
  getLanguageInfo,
  isRTL,
  getTextStyles,
  detectConversationLanguage,
};

export default languageUtils;
