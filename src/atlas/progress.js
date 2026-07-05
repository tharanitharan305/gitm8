import * as clack from '@clack/prompts';

/**
 * Simple progress reporter for indexing phases.
 * Wraps @clack/prompts spinner and provides phase/progress updates.
 */
export class ProgressReporter {
  constructor() {
    this.spinner = null;
    this.currentPhase = '';
  }

  /**
   * Report a new phase or progress update.
   * @param {string} msg - Message to display
   * @param {number} [current] - Current item number
   * @param {number} [total] - Total items
   */
  update(msg, current, total) {
    if (total !== undefined && current !== undefined) {
      const pct = Math.round((current / total) * 100);
      const bar = this._renderBar(pct);
      this._ensureSpinner(`${msg}\n  ${bar} ${pct}% (${current}/${total})`);
    } else {
      this._ensureSpinner(msg);
    }
  }

  /**
   * Mark the current phase as complete with a success message.
   * @param {string} msg
   */
  done(msg) {
    if (this.spinner) {
      this.spinner.stop(msg);
      this.spinner = null;
    }
    console.log(`  ${msg}`);
  }

  /**
   * Show an error message.
   * @param {string} msg
   */
  error(msg) {
    if (this.spinner) {
      this.spinner.stop(msg);
      this.spinner = null;
    }
    console.error(`  ✖ ${msg}`);
  }

  _ensureSpinner(msg) {
    if (!this.spinner) {
      this.spinner = clack.spinner();
      this.spinner.start(msg);
    } else {
      this.spinner.message(msg);
    }
  }

  _renderBar(pct) {
    const width = 20;
    const filled = Math.round((pct / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }
}
