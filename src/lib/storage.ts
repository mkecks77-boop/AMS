import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Dateispeicher: S3-kompatibler Objektspeicher (z. B. in einem EU-Rechenzentrum), wenn S3_BUCKET gesetzt ist,
 * sonst lokales Verzeichnis UPLOAD_DIR (Standard ./uploads – für Entwicklung und Einzelserver).
 */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements Storage {
  constructor(private root: string) {}
  private file(key: string) {
    // Schlüssel sind serverseitig erzeugt; Pfad dennoch gegen Ausbruch absichern
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Ungültiger Speicherschlüssel");
    return p;
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, data);
  }
  get(key: string) {
    return readFile(this.file(key));
  }
  async remove(key: string) {
    await rm(this.file(key), { force: true });
  }
}

class S3Storage implements Storage {
  private client = new S3Client({
    region: process.env.S3_REGION ?? "eu-central-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
  constructor(private bucket: string) {}
  async put(key: string, data: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType, ServerSideEncryption: "AES256" }));
  }
  async get(key: string) {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let storage: Storage | null = null;

export function getStorage(): Storage {
  storage ??= process.env.S3_BUCKET ? new S3Storage(process.env.S3_BUCKET) : new LocalStorage(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"));
  return storage;
}

/** nur für Tests */
export function setStorage(s: Storage) {
  storage = s;
}
