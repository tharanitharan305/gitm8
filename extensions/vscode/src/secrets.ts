import * as vscode from 'vscode';

const API_KEY_KEY = 'gitm8-apiKey';

let _secretStorage: vscode.SecretStorage | undefined;

/**
 * Initialize secrets with the extension context.
 * Must be called during activate() before using other functions.
 */
export function initSecrets(context: vscode.ExtensionContext): void {
  _secretStorage = context.secrets;
}

function getStorage(): vscode.SecretStorage {
  if (!_secretStorage) {
    throw new Error('Secrets not initialized. Call initSecrets() during activation.');
  }
  return _secretStorage;
}

/**
 * Store the API key in VS Code's encrypted SecretStorage.
 * More secure than writing to a config file on disk.
 */
export async function storeApiKey(key: string): Promise<void> {
  await getStorage().store(API_KEY_KEY, key);
}

/**
 * Retrieve the stored API key.
 */
export async function getApiKey(): Promise<string | undefined> {
  return getStorage().get(API_KEY_KEY);
}

/**
 * Delete the stored API key.
 */
export async function deleteApiKey(): Promise<void> {
  await getStorage().delete(API_KEY_KEY);
}

/**
 * Subscribe to API key changes.
 */
export function onApiKeyChanged(callback: (newKey: string | undefined) => void): vscode.Disposable {
  return getStorage().onDidChange((e) => {
    if (e.key === API_KEY_KEY) {
      getApiKey().then(callback);
    }
  });
}
