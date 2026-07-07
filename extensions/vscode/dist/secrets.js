"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSecrets = initSecrets;
exports.storeApiKey = storeApiKey;
exports.getApiKey = getApiKey;
exports.deleteApiKey = deleteApiKey;
exports.onApiKeyChanged = onApiKeyChanged;
const API_KEY_KEY = 'gitm8-apiKey';
let _secretStorage;
/**
 * Initialize secrets with the extension context.
 * Must be called during activate() before using other functions.
 */
function initSecrets(context) {
    _secretStorage = context.secrets;
}
function getStorage() {
    if (!_secretStorage) {
        throw new Error('Secrets not initialized. Call initSecrets() during activation.');
    }
    return _secretStorage;
}
/**
 * Store the API key in VS Code's encrypted SecretStorage.
 * More secure than writing to a config file on disk.
 */
async function storeApiKey(key) {
    await getStorage().store(API_KEY_KEY, key);
}
/**
 * Retrieve the stored API key.
 */
async function getApiKey() {
    return getStorage().get(API_KEY_KEY);
}
/**
 * Delete the stored API key.
 */
async function deleteApiKey() {
    await getStorage().delete(API_KEY_KEY);
}
/**
 * Subscribe to API key changes.
 */
function onApiKeyChanged(callback) {
    return getStorage().onDidChange((e) => {
        if (e.key === API_KEY_KEY) {
            getApiKey().then(callback);
        }
    });
}
//# sourceMappingURL=secrets.js.map