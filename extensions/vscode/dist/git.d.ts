/**
 * Execute a git command and return stdout.
 * Uses the git path from VS Code settings.
 */
export declare function execGit(args: string[]): Promise<string>;
/**
 * Execute a git command synchronously (for simple checks).
 */
export declare function execGitSync(args: string[]): string;
/**
 * Check if we're inside a git repository.
 */
export declare function isInRepo(): Promise<boolean>;
//# sourceMappingURL=git.d.ts.map