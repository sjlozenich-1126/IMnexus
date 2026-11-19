import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import multer from 'multer';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const VAULT_DIR = path.join(ROOT_DIR, 'uploads', 'vault');
const INDEX_PATH = path.join(VAULT_DIR, 'index.json');
const KEY_PATH = path.join(VAULT_DIR, '.vault.key');
const CONFIG_PATH = path.join(ROOT_DIR, 'firebase-applet-config.json');

interface VaultFileMeta {
  fileId: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  iv: string;
  authTag: string;
  isPublic: boolean;
  createdAt: string;
}

function ensureVaultDir(): void {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify({}, null, 2), 'utf-8');
  }
}

function getMasterKey(): Buffer {
  ensureVaultDir();
  if (process.env.VAULT_ENCRYPTION_KEY && process.env.VAULT_ENCRYPTION_KEY.length >= 16) {
    return crypto.scryptSync(process.env.VAULT_ENCRYPTION_KEY, 'imnexus-vault-salt', 32);
  }
  if (fs.existsSync(KEY_PATH)) {
    const hex = fs.readFileSync(KEY_PATH, 'utf-8').trim();
    if (hex.length === 64) {
      return Buffer.from(hex, 'hex');
    }
  }
  const generated = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, generated.toString('hex'), { mode: 0o600 });
  return generated;
}

function readIndex(): Record<string, VaultFileMeta> {
  ensureVaultDir();
  try {
    const raw = fs.readFileSync(INDEX_PATH, 'utf-8');
    return JSON.parse(raw) as Record<string, VaultFileMeta>;
  } catch {
    return {};
  }
}

function writeIndex(index: Record<string, VaultFileMeta>): void {
  ensureVaultDir();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
}

function getFirebaseApiKey(): string {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const cfg = JSON.parse(raw) as { apiKey?: string };
    return cfg.apiKey || '';
  } catch {
    return '';
  }
}

async function verifyFirebaseToken(token: string): Promise<{ uid: string; email: string } | null> {
  if (!token) return null;
  const apiKey = getFirebaseApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return { uid: user.localId, email: user.email || '' };
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.length > 10) {
    return queryToken;
  }
  return '';
}

async function startServer(): Promise<void> {
  ensureVaultDir();
  const masterKey = getMasterKey();
  const app = express();

  app.use(express.json({ limit: '5mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', encryption: 'aes-256-gcm' });
  });

  // Upload and encrypt file into AES-256-GCM vault
  app.post('/api/vault/upload', upload.single('file'), async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    const verified = await verifyFirebaseToken(token);
    if (!verified) {
      res.status(401).json({ error: 'Authentication required to upload encrypted vault assets.' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }

    const fileId = `vf_${crypto.randomBytes(12).toString('hex')}`;
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    const encryptedBuf = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const encPath = path.join(VAULT_DIR, `${fileId}.enc`);
    fs.writeFileSync(encPath, encryptedBuf);

    const isPublic = req.body?.isPublic === 'true' || req.body?.isPublic === true;
    const meta: VaultFileMeta = {
      fileId,
      ownerId: verified.uid,
      fileName: file.originalname || `${fileId}.bin`,
      mimeType: file.mimetype || 'application/octet-stream',
      fileSize: file.size,
      sha256,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      isPublic,
      createdAt: new Date().toISOString(),
    };

    const index = readIndex();
    index[fileId] = meta;
    writeIndex(index);

    res.status(201).json({
      fileId: meta.fileId,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      fileSize: meta.fileSize,
      sha256: meta.sha256,
      encrypted: true,
    });
  });

  // Update public visibility flag for a vault file
  app.patch('/api/vault/visibility/:fileId', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    const verified = await verifyFirebaseToken(token);
    if (!verified) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const rawId = req.params.fileId;
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!/^[a-zA-Z0-9_\-]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid file ID.' });
      return;
    }
    const index = readIndex();
    const meta = index[fileId];
    if (!meta) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    meta.isPublic = Boolean(req.body?.isPublic);
    index[fileId] = meta;
    writeIndex(index);
    res.json({ fileId, isPublic: meta.isPublic });
  });

  // Decrypt and stream file (supports HTTP Range for video/audio scrubbing)
  app.get('/api/vault/file/:fileId', async (req: Request, res: Response) => {
    const rawId = req.params.fileId;
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!/^[a-zA-Z0-9_\-]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid file ID.' });
      return;
    }
    const index = readIndex();
    const meta = index[fileId];
    if (!meta) {
      res.status(404).json({ error: 'File not found in encrypted vault.' });
      return;
    }

    if (!meta.isPublic) {
      const token = extractBearerToken(req);
      const verified = await verifyFirebaseToken(token);
      if (!verified) {
        res.status(401).json({ error: 'Authentication required to decrypt private evidence.' });
        return;
      }
    }

    const encPath = path.join(VAULT_DIR, `${fileId}.enc`);
    if (!fs.existsSync(encPath)) {
      res.status(404).json({ error: 'Encrypted payload missing.' });
      return;
    }

    try {
      const encData = fs.readFileSync(encPath);
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        masterKey,
        Buffer.from(meta.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(meta.authTag, 'hex'));
      const plain = Buffer.concat([decipher.update(encData), decipher.final()]);

      res.setHeader('Content-Type', meta.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${meta.fileName.replace(/"/g, '')}"`
      );
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('X-Content-Sha256', meta.sha256);

      const rangeHeader = req.headers.range;
      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const parts = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : plain.length - 1;
        if (!Number.isNaN(start) && start < plain.length) {
          const safeEnd = Math.min(end, plain.length - 1);
          const chunk = plain.subarray(start, safeEnd + 1);
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${plain.length}`);
          res.setHeader('Content-Length', String(chunk.length));
          res.send(chunk);
          return;
        }
      }

      res.setHeader('Content-Length', String(plain.length));
      res.send(plain);
    } catch {
      res.status(500).json({ error: 'Decryption failed.' });
    }
  });

  app.delete('/api/vault/file/:fileId', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    const verified = await verifyFirebaseToken(token);
    if (!verified) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const rawId = req.params.fileId;
    const fileId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!/^[a-zA-Z0-9_\-]+$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid file ID.' });
      return;
    }
    const index = readIndex();
    const meta = index[fileId];
    if (meta) {
      const encPath = path.join(VAULT_DIR, `${fileId}.enc`);
      if (fs.existsSync(encPath)) {
        fs.unlinkSync(encPath);
      }
      delete index[fileId];
      writeIndex(index);
    }
    res.json({ deleted: fileId });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IMnexus server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start IMnexus server:', err);
  process.exit(1);
});
