import * as vscode from 'vscode';
/**
 * Initialize secrets with the extension context.
 * Must be called during activate() before using other functions.
 */
export declare function initSecrets(context: vscode.ExtensionContext): void;
/**
 * Store the API key in VS Code's encrypted SecretStorage.
 * More secure than writing to a config file on disk.
 */
export declare function storeApiKey(key: string): Promise<void>;
/**
 * Retrieve the stored API key.
 */
export declare function getApiKey(): Promise<string | undefined>;
/**
 * Delete the stored API key.
 */
export declare function deleteApiKey(): Promise<void>;
/**
 * Subscribe to API key changes.
 */
export declare function onApiKeyChanged(callback: (newKey: string | undefined) => void): vscode.Disposable;
//# sourceMappingURL=secrets.d.ts.map