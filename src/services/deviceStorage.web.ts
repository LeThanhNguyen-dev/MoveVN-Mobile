// Browser storage is not encrypted. Keep auth data within the current tab.
function storageFor(key: string): Storage {
  return key.startsWith("movevn.auth.") ? window.sessionStorage : window.localStorage;
}

export async function getItemAsync(key: string): Promise<string | null> {
  return storageFor(key).getItem(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  storageFor(key).setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  storageFor(key).removeItem(key);
}
