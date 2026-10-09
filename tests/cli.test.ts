import { describe, it, expect } from 'vitest';
import { createCli } from '../src/cli.js';

describe('Moksy CLI', () => {
  it('should initialize commander with name and description', () => {
    const cli = createCli();
    expect(cli.name()).toBe('moksy');
    expect(cli.description()).toContain('API Simulator');
  });

  it('should have start and validate commands', () => {
    const cli = createCli();
    const commandNames = cli.commands.map((cmd) => cmd.name());
    expect(commandNames).toContain('start');
    expect(commandNames).toContain('validate');
  });

  it('should output help information with start command options', () => {
    const cli = createCli();
    const startCmd = cli.commands.find((cmd) => cmd.name() === 'start');
    expect(startCmd).toBeDefined();

    const helpInformation = startCmd!.helpInformation();
    expect(helpInformation).toContain('--config');
    expect(helpInformation).toContain('--agreement');
    expect(helpInformation).toContain('--port');
    expect(helpInformation).toContain('--host');
  });
});
