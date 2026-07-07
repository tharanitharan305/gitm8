import * as vscode from 'vscode';
import { openConfigPanel } from '../views/configPanel';

/**
 * Open the gitm8 configuration panel (webview).
 */
export async function openConfig(): Promise<void> {
  openConfigPanel();
}
