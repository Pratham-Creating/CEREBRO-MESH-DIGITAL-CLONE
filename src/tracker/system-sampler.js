import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

export function createSystemSampler() {
  const scriptPath = fileURLToPath(new URL('../../scripts/system-snapshot.ps1', import.meta.url));
  return async () => {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
    ], { windowsHide: true, timeout: 10_000, maxBuffer: 1024 * 1024 });
    
    // Remove unescaped control characters which occasionally corrupt PowerShell's ConvertTo-Json output
    const cleanStdout = stdout.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    return JSON.parse(cleanStdout);
  };
}
