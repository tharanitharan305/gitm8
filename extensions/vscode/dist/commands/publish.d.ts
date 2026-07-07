/**
 * Publish the current branch:
 * - If no upstream: `git push -u origin <branch>`
 * - If upstream exists: `git push`
 * - Offer to create a PR via `gh` CLI
 */
export declare function publishBranch(): Promise<void>;
//# sourceMappingURL=publish.d.ts.map