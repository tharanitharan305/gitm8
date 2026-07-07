/**
 * Check if gitm8 CLI is installed and available in PATH.
 * Caches the result for the session.
 */
export declare function isGitm8Available(): Promise<boolean>;
/**
 * Get the path to the gitm8 binary (if found).
 */
export declare function getGitm8Path(): string | undefined;
/**
 * Prompt the user to install gitm8 if it's not found.
 * Returns true if the user chose to install (or already has it).
 */
export declare function ensureGitm8(): Promise<boolean>;
/**
 * Refresh the cached availability (e.g. after installation).
 */
export declare function refreshCache(): void;
//# sourceMappingURL=gitm8.d.ts.map