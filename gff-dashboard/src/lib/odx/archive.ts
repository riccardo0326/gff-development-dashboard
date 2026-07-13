import yauzl from "yauzl";

export interface ArchiveEntry {
  name: string;
  buffer: Buffer;
}

const ODX_EXTENSIONS = /\.(odx|xml)$/i;
const ARCHIVE_EXTENSIONS = /\.(zip|pdx)$/i;

function openZipFromBuffer(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) {
        reject(error ?? new Error("Could not open archive"));
        return;
      }
      resolve(zipfile);
    });
  });
}

function readZipEntry(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error(`Could not read ${entry.fileName}`));
        return;
      }

      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  });
}

async function extractZipEntries(buffer: Buffer): Promise<ArchiveEntry[]> {
  const zipfile = await openZipFromBuffer(buffer);
  const entries: ArchiveEntry[] = [];

  await new Promise<void>((resolve, reject) => {
    zipfile.on("entry", (entry: yauzl.Entry) => {
      void (async () => {
        try {
          if (!entry.fileName || entry.fileName.endsWith("/")) {
            zipfile.readEntry();
            return;
          }

          if (ODX_EXTENSIONS.test(entry.fileName)) {
            const fileBuffer = await readZipEntry(zipfile, entry);
            const name = entry.fileName.split("/").pop() ?? entry.fileName;
            entries.push({ name, buffer: fileBuffer });
          }

          zipfile.readEntry();
        } catch (error) {
          reject(error);
        }
      })();
    });

    zipfile.on("end", () => resolve());
    zipfile.on("error", reject);
    zipfile.readEntry();
  });

  return entries;
}

export async function extractOdxEntries(
  buffer: Buffer,
  filename: string,
): Promise<ArchiveEntry[]> {
  const lower = filename.toLowerCase();

  if (ARCHIVE_EXTENSIONS.test(lower)) {
    const entries = await extractZipEntries(buffer);
    if (entries.length === 0) {
      throw new Error("Archive contains no .odx or .xml files");
    }
    return entries;
  }

  if (ODX_EXTENSIONS.test(lower)) {
    return [{ name: filename.split("/").pop() ?? filename, buffer }];
  }

  throw new Error("Unsupported file type. Use .odx, .xml, .pdx, or .zip");
}
