'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeHouseId(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

function createServer({ requireAuth }) {
  const app = express();

  ensureDir(path.join(UPLOAD_DIR, 'chat'));

  app.get('/', (_req, res) => {
    res.json({ ok: true, service: 'casoiko-notifier' });
  });

  app.use('/uploads', express.static(UPLOAD_DIR));

  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const houseId = sanitizeHouseId(req.body.house_id);
      const dir = path.join(UPLOAD_DIR, 'chat', houseId || 'unknown');
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uid = req.user.uid;
      const ts = Date.now();
      const ext = file.mimetype === 'image/png' ? 'png' : 'jpg';
      cb(null, `${ts}_${uid}.${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const extOk = ['.jpg', '.jpeg', '.png'].includes(ext);
      const mimeOk =
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png' ||
        (file.mimetype === 'application/octet-stream' && extOk);
      if (mimeOk) {
        cb(null, true);
        return;
      }
      console.error('Upload rejeitado:', file.mimetype, file.originalname);
      cb(new Error('Tipo de arquivo nao permitido'));
    },
  });

  app.post(
    '/api/chat/upload',
    requireAuth,
    upload.single('image'),
    (req, res) => {
      console.log(
        'Upload chat:',
        req.user?.uid,
        req.body?.house_id,
        req.file?.mimetype,
        req.file?.size,
      );
      if (!PUBLIC_BASE_URL) {
        return res.status(500).json({
          error: 'PUBLIC_BASE_URL nao configurada no servidor',
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Imagem ausente' });
      }

      const houseId = sanitizeHouseId(req.body.house_id);
      if (!houseId) {
        return res.status(400).json({ error: 'house_id obrigatorio' });
      }

      const relative = path
        .relative(UPLOAD_DIR, req.file.path)
        .split(path.sep)
        .join('/');
      const url = `${PUBLIC_BASE_URL}/uploads/${relative}`;
      res.json({ url });
    }
  );

  app.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Arquivo muito grande (max 5 MB)' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'Erro no upload' });
    }
    next();
  });

  return app;
}

module.exports = { createServer };
