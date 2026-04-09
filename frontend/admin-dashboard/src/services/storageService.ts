const memoryStore = new Map<string, unknown>();

type StorageLike = Storage | null;

const safeStorage = (): StorageLike => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (_err) {
    return null;
  }
};

const getParsed = (value: string | null): unknown => {
  if (value == null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch (_err) {
    return value;
  }
};

const setStringified = (storage: Storage, key: string, value: unknown) => {
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  storage.setItem(key, payload);
};

export const StorageService = {
  async getItem(key: string): Promise<unknown | null> {
    const storage = safeStorage();
    if (!storage) return (memoryStore.get(key) as unknown) ?? null;
    return getParsed(storage.getItem(key));
  },

  async setItem(key: string, value: unknown): Promise<void> {
    const storage = safeStorage();
    if (!storage) {
      memoryStore.set(key, value);
      return;
    }
    setStringified(storage, key, value);
  },

  async removeItem(key: string): Promise<void> {
    const storage = safeStorage();
    if (!storage) {
      memoryStore.delete(key);
      return;
    }
    storage.removeItem(key);
  },

  async savePendingListing(id: string, data: unknown, lastStepIndex = 0) {
    if (!id) return null;
    const record = {
      id,
      data,
      lastStepIndex,
      updatedAt: new Date().toISOString()
    };
    await this.setItem(`pending_listing_${id}`, record);
    return record;
  },

  async getPendingListing(id: string) {
    if (!id) return null;
    return this.getItem(`pending_listing_${id}`);
  },

  async removePendingListing(id: string): Promise<void> {
    if (!id) return;
    await this.removeItem(`pending_listing_${id}`);
  },

  getAccessToken(): string | null {
    const storage = safeStorage();
    if (!storage) return null;
    return storage.getItem('access_token');
  }
};
