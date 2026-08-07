const CACHE_PREFIX = 'davai-quest-cache:';

export function saveCache(userKey, state) {
  try {
    localStorage.setItem(CACHE_PREFIX + userKey, JSON.stringify({ state, savedAt: Date.now() }));
  } catch (e) {
    // хранилище недоступно (приватный режим, квота) — офлайн-кэш просто не сработает
  }
}

export function loadCache(userKey) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.state || null;
  } catch (e) {
    return null;
  }
}

export function isNetworkError(err) {
  return err instanceof TypeError || /failed to fetch/i.test(err?.message || '');
}

// Обёртка для операций записи: если сети нет — не роняем приложение,
// а сообщаем пользователю, что изменение не сохранилось.
export async function guardOffline(fn, onOffline) {
  try {
    return await fn();
  } catch (err) {
    if (isNetworkError(err)) {
      onOffline?.();
      return null;
    }
    throw err;
  }
}
