#!/usr/bin/env node
import { build, dev, start, type RunOptions } from './server/run.ts';

const commands = { dev, build, start };
const optionNames: Record<string, keyof RunOptions> = {
  root: 'root',
  entry: 'entry',
  'out-dir': 'outDir',
  outDir: 'outDir',
  port: 'port',
  host: 'host',
  'revalidate-secret': 'revalidateSecret',
  revalidateSecret: 'revalidateSecret',
};

const usage = `Usage: engine-ts [dev | build | start] [options]

Options:
  --root <path>                 Project folder
  --entry <path>                Server entry relative to root
  --out-dir <path>              Build output relative to root
  --port <number>               Server port
  --host <host>                 Interface or hostname to listen on
  --revalidate-secret <secret>  Enable on-demand revalidation
  --help                        Show this message`;

function argumentError(message: string): never {
  throw new Error(`${message}\n\n${usage}`);
}

function parsePort(value: string): number {
  if (!/^\d+$/u.test(value)) {
    argumentError(`Invalid port: ${value}`);
  }
  const port = Number(value);
  if (port > 65_535) {
    argumentError(`Invalid port: ${value}`);
  }

  return port;
}

function parseOptions(arguments_: string[]): RunOptions {
  const options: RunOptions = {};

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!argument.startsWith('--')) {
      argumentError(`Unexpected argument: ${argument}`);
    }

    const flagEnd = argument.indexOf('=');
    const flag = argument.slice(2, flagEnd === -1 ? undefined : flagEnd);
    const inlineValue =
      flagEnd === -1 ? undefined : argument.slice(flagEnd + 1);
    const option = optionNames[flag];
    if (!option) {
      argumentError(`Unknown option: --${flag}`);
    }

    const value = inlineValue ?? arguments_[++index];
    if (!value || value.startsWith('--')) {
      argumentError(`Missing value for --${flag}`);
    }
    if (option === 'port') {
      options.port = parsePort(value);
    } else {
      options[option] = value;
    }
  }

  return options;
}

function runCli(arguments_: string[]) {
  if (arguments_.includes('--help') || arguments_.includes('-h')) {
    console.log(usage);
    return;
  }

  const first = arguments_[0];
  const command = (
    first?.startsWith('-') ? 'dev' : (first ?? 'dev')
  ) as keyof typeof commands;
  if (!Object.hasOwn(commands, command)) {
    argumentError(`Unknown command: ${command}`);
  }

  return commands[command](
    parseOptions(arguments_.slice(first?.startsWith('-') ? 0 : 1)),
  );
}

try {
  await runCli(process.argv.slice(2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
