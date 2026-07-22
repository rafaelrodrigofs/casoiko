/**
 * Painel de design: tokens, versões e upload de assets.
 */

import { useEffect, useState } from 'react';

/**
 * @param {{
 *   tokens?: Record<string, unknown>,
 *   versions?: Array<{ id: string, name?: string, createdAt?: string, revision?: number }>,
 *   projectId?: string | null,
 *   onSetTokens?: (tokens: Record<string, unknown>) => void,
 *   onCreateVersion?: (name?: string) => void,
 *   onRestoreVersion?: (versionId: string) => void,
 *   onAssetUploaded?: (url: string) => void,
 * }} props
 */
export default function DesignPanel({
  tokens = {},
  versions = [],
  projectId,
  onSetTokens,
  onCreateVersion,
  onRestoreVersion,
  onAssetUploaded,
}) {
  const [tokenKey, setTokenKey] = useState('');
  const [tokenValue, setTokenValue] = useState('');
  const [versionName, setVersionName] = useState('');
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : { assets: [] }))
      .then((data) => {
        if (!cancelled) setAssets(data.assets || []);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const entries = Object.entries(tokens || {});

  const addToken = () => {
    const key = tokenKey.trim();
    if (!key) return;
    onSetTokens?.({ ...tokens, [key]: tokenValue });
    setTokenKey('');
    setTokenValue('');
  };

  const removeToken = (key) => {
    const next = { ...tokens };
    delete next[key];
    onSetTokens?.(next);
  };

  const onFile = async (file) => {
    if (!file || !projectId) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);
      const mime = file.type || 'image/png';
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/assets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            dataUrl: `data:${mime};base64,${b64}`,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAssets((prev) => [
        { name: data.name, url: data.url },
        ...prev.filter((a) => a.name !== data.name),
      ]);
      onAssetUploaded?.(data.url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="props-panel design-panel">
      <section className="prop-section">
        <div className="prop-section-head">
          <span className="prop-section-title">Tokens</span>
        </div>
        <div className="prop-section-body">
          {entries.length === 0 ? (
            <p className="props-empty" style={{ margin: 0 }}>
              Nenhum token ainda
            </p>
          ) : (
            <ul className="design-token-list">
              {entries.map(([k, v]) => (
                <li key={k}>
                  <code>{k}</code>
                  <span>{String(v)}</span>
                  <button
                    type="button"
                    className="tool-btn"
                    title="Remover"
                    onClick={() => removeToken(k)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="prop-row">
            <input
              className="prop-text-full"
              placeholder="nome"
              value={tokenKey}
              onChange={(e) => setTokenKey(e.target.value)}
            />
            <input
              className="prop-text-full"
              placeholder="valor"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
            />
          </div>
          <button type="button" className="tool-btn" onClick={addToken}>
            Adicionar token
          </button>
        </div>
      </section>

      <section className="prop-section">
        <div className="prop-section-head">
          <span className="prop-section-title">Versões</span>
        </div>
        <div className="prop-section-body">
          <div className="prop-row">
            <input
              className="prop-text-full"
              placeholder="Nome do snapshot"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="tool-btn"
            onClick={() => {
              onCreateVersion?.(versionName.trim() || undefined);
              setVersionName('');
            }}
          >
            Salvar versão
          </button>
          {versions.length === 0 ? (
            <p className="props-empty" style={{ margin: '8px 0 0' }}>
              Nenhum snapshot
            </p>
          ) : (
            <ul className="design-version-list">
              {[...versions].reverse().map((v) => (
                <li key={v.id}>
                  <div>
                    <strong>{v.name || v.id}</strong>
                    <small>
                      {v.createdAt
                        ? new Date(v.createdAt).toLocaleString()
                        : ''}{' '}
                      · rev {v.revision ?? '—'}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Restaurar “${v.name || v.id}”? A tela atual será substituída.`,
                        )
                      ) {
                        onRestoreVersion?.(v.id);
                      }
                    }}
                  >
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="prop-section">
        <div className="prop-section-head">
          <span className="prop-section-title">Assets</span>
        </div>
        <div className="prop-section-body">
          <label className="tool-btn" style={{ display: 'inline-block' }}>
            {uploading ? 'Enviando…' : 'Upload imagem'}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploading || !projectId}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) onFile(f);
              }}
            />
          </label>
          {assets.length > 0 && (
            <ul className="design-asset-list">
              {assets.map((a) => (
                <li key={a.name}>
                  <code
                    title="Copiar URL"
                    onClick={() => {
                      navigator.clipboard?.writeText(a.url);
                      onAssetUploaded?.(a.url);
                    }}
                  >
                    {a.url}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
