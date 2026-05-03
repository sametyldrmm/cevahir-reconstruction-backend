export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0);
      }
    } catch {
      // ignore
    }
  }

  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
