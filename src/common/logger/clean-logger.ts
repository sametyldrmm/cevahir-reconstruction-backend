import { ConsoleLogger } from '@nestjs/common';

/**
 * Unicode karakterleri temizleyen helper fonksiyon
 */
function cleanUnicode(text: string): string {
  if (typeof text !== 'string') {
    return text;
  }

  // Emoji ve özel unicode karakterleri kaldır (ASCII dışı karakterler)
  // Türkçe karakterleri koru (ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü)
  return text.replace(/[^\x00-\x7F\u00C0-\u017F\s]/g, '');
}

/**
 * Logger metodlarına geçirilen argümanları temizler
 */
function cleanArgs(...args: any[]): any[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return cleanUnicode(arg);
    }
    if (arg instanceof Error && arg.message) {
      // Error objelerinin message'ını temizle
      const cleanedError = new Error(cleanUnicode(arg.message));
      cleanedError.name = arg.name;
      cleanedError.stack = arg.stack ? cleanUnicode(arg.stack) : undefined;
      return cleanedError;
    }
    if (Array.isArray(arg)) {
      return arg.map((item) =>
        typeof item === 'string' ? cleanUnicode(item) : item,
      );
    }
    return arg;
  });
}

function withTimestampPrefix(message: any): any {
  if (typeof message !== 'string') return message;
  const iso = new Date().toISOString();
  return `[${iso}] ${message}`;
}

/**
 * Unicode karakterleri otomatik temizleyen Logger wrapper
 * NestJS Logger'ını extend eder ve tüm log mesajlarından unicode karakterleri kaldırır
 */
export class CleanLogger extends ConsoleLogger {
  log(message: any, ...optionalParams: any[]): void {
    const cleaned = cleanArgs(message, ...optionalParams);
    super.log(withTimestampPrefix(cleaned[0]), ...cleaned.slice(1));
  }

  error(message: any, ...optionalParams: any[]): void {
    const cleaned = cleanArgs(message, ...optionalParams);
    super.error(withTimestampPrefix(cleaned[0]), ...cleaned.slice(1));
  }

  warn(message: any, ...optionalParams: any[]): void {
    const cleaned = cleanArgs(message, ...optionalParams);
    super.warn(withTimestampPrefix(cleaned[0]), ...cleaned.slice(1));
  }

  debug(message: any, ...optionalParams: any[]): void {
    const cleaned = cleanArgs(message, ...optionalParams);
    super.debug(withTimestampPrefix(cleaned[0]), ...cleaned.slice(1));
  }

  verbose(message: any, ...optionalParams: any[]): void {
    const cleaned = cleanArgs(message, ...optionalParams);
    super.verbose(withTimestampPrefix(cleaned[0]), ...cleaned.slice(1));
  }
}
