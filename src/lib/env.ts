import fs from 'node:fs';
import path from 'node:path';

/**
 * Lee una variable de entorno del proceso y, si no está, del `.env` del proyecto.
 * Astro no inyecta al runtime las variables sin prefijo PUBLIC_, así que el
 * fallback al archivo es lo que hace que funcionen en el servidor.
 */
export function readEnv(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return undefined;
    for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const match = line.match(new RegExp(`^\\s*${name}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`));
      if (match && match[1]) {
        process.env[name] = match[1].trim();
        return process.env[name];
      }
    }
  } catch {
    /* sin .env legible */
  }
  return undefined;
}
