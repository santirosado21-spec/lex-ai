import { mkdir, mkdtemp, writeFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);

// Only user-invoked document actions call this; inference never receives an opener tool.
export function createLocalFileOpener({dataDir, launch = file => execute('/usr/bin/open', [file], {timeout: 15_000})}) {
  return async ({name, bytes}) => {
    if (typeof name !== 'string' || name.length > 200 || /[\\/\u0000-\u001f]/.test(name) || !/\.(docx|pdf|txt|md)$/i.test(name)) throw Error('Nombre de escrito no permitido.');
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 20*1024*1024) throw Error('El escrito supera el tamaño permitido.');
    const base = await realpath(dataDir);
    const exports = path.join(base, 'opened-documents');
    await mkdir(exports, {recursive: true, mode: 0o700});
    const info = await lstat(exports);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(exports) !== exports) throw Error('Directorio de escritos no válido.');
    const dir = await mkdtemp(path.join(exports, 'document-'));
    const file = path.join(dir, name);
    await writeFile(file, bytes, {mode: 0o600, flag: 'wx'});
    try { await launch(file); } catch { throw Error('No se pudo abrir el escrito. Descarga el archivo y ábrelo con tu editor.'); }
    return {opened: true, name};
  };
}
