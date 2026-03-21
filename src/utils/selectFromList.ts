import chalk from 'chalk';

/**
 * Shows an interactive arrow-key selection menu in the terminal.
 * Returns the selected item, or null if the user cancelled (Ctrl+C / Escape).
 */
export function selectFromList(items: string[], prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (items.length === 0) {
      resolve(null);
      return;
    }

    let selected = 0;

    const render = () => {
      // Move cursor up by the number of lines we drew last time, then redraw
      process.stdout.write(`\n${chalk.bold(prompt)}\n`);
      for (let i = 0; i < items.length; i++) {
        if (i === selected) {
          process.stdout.write(`  ${chalk.cyan('›')} ${chalk.cyan(items[i])}\n`);
        } else {
          process.stdout.write(`    ${items[i]}\n`);
        }
      }
    };

    const clearMenu = () => {
      // +2 for the prompt line and the leading blank line
      const lines = items.length + 2;
      for (let i = 0; i < lines; i++) {
        process.stdout.write('\x1B[1A\x1B[2K');
      }
    };

    render();

    const { stdin } = process;
    const previousRawMode = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf-8');

    const onData = (key: string) => {
      if (key === '\x1B[A' || key === '\x1B[D') {
        // Up arrow or left arrow
        selected = (selected - 1 + items.length) % items.length;
        clearMenu();
        render();
      } else if (key === '\x1B[B' || key === '\x1B[C') {
        // Down arrow or right arrow
        selected = (selected + 1) % items.length;
        clearMenu();
        render();
      } else if (key === '\r' || key === '\n') {
        // Enter
        cleanup();
        clearMenu();
        process.stdout.write(`  ${chalk.cyan('›')} ${chalk.cyan(items[selected])}\n\n`);
        resolve(items[selected]);
      } else if (key === '\x03' || key === '\x1B') {
        // Ctrl+C or Escape
        cleanup();
        clearMenu();
        process.stdout.write('\n');
        resolve(null);
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(previousRawMode ?? false);
      stdin.pause();
    };

    stdin.on('data', onData);
  });
}
