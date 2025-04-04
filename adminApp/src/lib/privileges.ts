import { shell } from 'electron';
import { getPlatformInfo } from './systemInfo';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Runs a command with administrator privileges using the system's native elevation mechanism
 * @param command The command to execute
 * @param args Array of command arguments
 * @returns Promise<void>
 */
export async function runAsAdmin(command: string, args: string[] = []): Promise<void> {
  const platformInfo = await getPlatformInfo();
  const fullCommand = `${command} ${args.join(' ')}`;

  if (platformInfo.platform === 'win32') {
    // On Windows, use PowerShell to run the command with elevation
    const psCommand = `Start-Process -FilePath "${command}" -ArgumentList "${args.join('" "')}" -Verb RunAs -Wait -NoNewWindow`;
    await shell.openExternal(`powershell -Command "${psCommand}"`);
  } else if (platformInfo.platform === 'darwin' || platformInfo.platform === 'linux') {
    // On macOS and Linux, use sudo
    await shell.openExternal(`sudo ${fullCommand}`);
  } else {
    throw new Error('Unsupported platform');
  }
}

/**
 * Runs a command with administrator privileges and returns its output
 * @param command The command to execute
 * @param args Array of command arguments
 * @returns Promise<{ stdout: string; stderr: string }>
 */
export async function runAsAdminWithOutput(command: string, args: string[] = []): Promise<{ stdout: string; stderr: string }> {
  const platformInfo = await getPlatformInfo();
  const fullCommand = `${command} ${args.join(' ')}`;

  if (platformInfo.platform === 'win32') {
    // On Windows, use PowerShell to run the command with elevation and capture output
    const psCommand = `Start-Process -FilePath "${command}" -ArgumentList "${args.join('" "')}" -Verb RunAs -Wait -NoNewWindow -RedirectStandardOutput (Join-Path $env:TEMP "output.txt") -RedirectStandardError (Join-Path $env:TEMP "error.txt"); Get-Content (Join-Path $env:TEMP "output.txt"); Get-Content (Join-Path $env:TEMP "error.txt")`;
    const { stdout, stderr } = await execAsync(`powershell -Command "${psCommand}"`);
    return { stdout, stderr };
  } else if (platformInfo.platform === 'darwin' || platformInfo.platform === 'linux') {
    // On macOS and Linux, use sudo and redirect output to temporary files
    const tempOutput = '/tmp/admin_output.txt';
    const tempError = '/tmp/admin_error.txt';
    const sudoCommand = `sudo ${fullCommand} > ${tempOutput} 2> ${tempError}; cat ${tempOutput}; cat ${tempError}`;
    const { stdout, stderr } = await execAsync(sudoCommand);
    return { stdout, stderr };
  }

  throw new Error('Unsupported platform');
}