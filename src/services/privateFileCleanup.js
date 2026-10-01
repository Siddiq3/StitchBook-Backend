const fs = require('fs/promises');
const path = require('path');

// Uploads are flat tenant directories. Unexpected subdirectories fail safely
// rather than performing an unbounded recursive deletion.
async function cleanupTenantFiles(root, shopIds, filesystem = fs) {
  let removed = 0;
  for (const shopId of shopIds) {
    if (!Number.isSafeInteger(Number(shopId)) || Number(shopId) < 1) throw new Error('Invalid file ownership');
    const directoryPath = path.join(root, String(shopId));
    let directory;
    try { directory = await filesystem.opendir(directoryPath); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    try {
      for await (const entry of directory) {
        if (entry.isDirectory()) throw new Error('File cleanup requires review of an unexpected directory');
        await filesystem.unlink(path.join(directoryPath, entry.name));
        if (++removed >= 100) return false;
      }
    } finally {
      try { await directory.close(); } catch (error) { if (error.code !== 'ERR_DIR_CLOSED') throw error; }
    }
    try { await filesystem.rmdir(directoryPath); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return true;
}
module.exports = { cleanupTenantFiles };
