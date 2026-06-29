import { useEffect, useMemo, useState } from "react";
import { getCatalogEntries, preloadIconManifest } from "./iconCatalog";

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function humanizeService(service) {
  const s = String(service || "").replace(/[_]+/g, "-");
  return s
    .replace(/^Amazon-/i, "")
    .replace(/^AWS-/i, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeResource(resource) {
  const r = String(resource || "");
  return r.replace(/[_]+/g, "-").replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function parseAwsCatalogId(id) {
  const base = String(id || "");
  const parts = base.split("_");

  if (parts[0] === "Res") {
    const sizePartIdx = parts.findIndex((p) => /^[0-9]{2,3}$/.test(p));
    if (sizePartIdx > 1) {
      const nameParts = parts.slice(1, sizePartIdx);
      const service = nameParts[0] || "";
      const resource = nameParts.slice(1).join("_") || "";
      return { service, resource };
    }
  }

  if (parts[0] === "Arch") {
    const sizePartIdx = parts.findIndex((p) => /^[0-9]{2,3}$/.test(p));
    if (sizePartIdx > 1) {
      const service = parts.slice(1, sizePartIdx).join("_") || "";
      return { service, resource: "" };
    }
  }

  // Group icon ids like Region_32 / Public-subnet_32
  const withoutSize = base.replace(/_[0-9]{2,3}(_Dark)?$/i, "");
  return { service: "", resource: withoutSize };
}

function entryLabel(e, provider) {
  if (!e) return "";
  if (String(provider) !== "aws") {
    const category = humanizeResource(e.category || "");
    const label = humanizeResource(e.service || e.id);
    if (category && label) return `${category} — ${label}`;
    return label || e.id;
  }

  const parsed = parseAwsCatalogId(e.id);
  if (e.type === "container") return humanizeResource(parsed.resource || parsed.service || e.id);
  if (parsed.resource) return `${humanizeService(parsed.service || e.service)} — ${humanizeResource(parsed.resource)}`;
  return humanizeService(parsed.service || e.service) || e.id;
}

export function IconCatalogModal({ open, type, provider = "aws", onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [service, setService] = useState(null);
  const [catalogNonce, setCatalogNonce] = useState(0);

  const providerKey = String(provider || "aws").toLowerCase();
  const isSearching = useMemo(() => Boolean(norm(query)), [query]);

  useEffect(() => {
    let active = true;
    preloadIconManifest().finally(() => {
      if (active) setCatalogNonce((n) => n + 1);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setService(null);
  }, [providerKey, type]);

  const entries = useMemo(() => {
    const all = getCatalogEntries(providerKey);
    return all.filter((e) => e?.type === (type || "resource"));
  }, [type, catalogNonce, providerKey]);

  const serviceNames = useMemo(() => {
    if (type !== "resource") return [];
    const set = new Set();
    for (const e of entries) {
      if (providerKey === "aws") {
        if (e?.service) set.add(String(e.service));
      } else if (e?.category || e?.service) {
        set.add(String(e.category || e.service));
      }
    }
    return [...set].sort((a, b) => humanizeService(a).localeCompare(humanizeService(b)));
  }, [entries, type, providerKey]);

  const filteredServices = useMemo(() => {
    if (type !== "resource") return [];
    const q = norm(query);
    if (!q) return serviceNames;
    return serviceNames.filter((s) => norm(humanizeService(s)).includes(q) || norm(s).includes(q));
  }, [query, serviceNames, type]);

  const filteredEntries = useMemo(() => {
    const q = norm(query);
    let list = entries;
    if (type === "resource" && service && !q) {
      if (providerKey === "aws") {
        list = list.filter((e) => String(e.service || "") === String(service));
      } else {
        list = list.filter((e) => String(e.category || e.service || "") === String(service));
      }
    }
    if (!q) return list.slice(0, type === "container" ? 50 : 300);
    return list
      .filter((e) => {
        const hay = [e.id, e.service, e.category, ...(e.aliases || [])].join(" ");
        return norm(hay).includes(q);
      })
      .slice(0, 300);
  }, [entries, query, service, type, providerKey]);

  if (!open) return null;

  return (
    <div className="catalog-modal__overlay" role="dialog" aria-modal="true">
      <div className="catalog-modal__panel">
        <div className="catalog-modal__header">
          <div className="catalog-modal__title">
            {type === "container" ? "Select a container icon" : "Select a service / resource icon"}
          </div>
          <button type="button" className="secondary small" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="catalog-modal__search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              type === "container"
                ? "Search containers (e.g. vpc, public subnet)"
                : providerKey === "azure"
                  ? "Search services/resources (e.g. virtual machine, blob storage)"
                  : providerKey === "gcp"
                    ? "Search services/resources (e.g. Cloud Run, BigQuery)"
                    : "Search services/resources (e.g. api gateway, dynamodb)"
            }
          />
        </div>

        <div
          className="catalog-modal__body"
          style={{ gridTemplateColumns: type === "resource" && !isSearching ? "280px 1fr" : "1fr" }}
        >
          {type === "resource" && !isSearching && (
            <div className="catalog-modal__services">
              <div className="catalog-modal__sectionTitle">
                {providerKey === "aws" ? "Services" : "Categories"}
              </div>
              <div className="catalog-modal__serviceList">
                {filteredServices.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`catalog-modal__service ${String(service) === String(s) ? "active" : ""}`}
                    onClick={() => setService(s)}
                    title={s}
                  >
                    {humanizeService(s) || s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="catalog-modal__entries">
            <div className="catalog-modal__sectionTitle">
              {type === "container"
                ? "Containers"
                : isSearching
                  ? "Results"
                  : service
                    ? humanizeService(service)
                    : "Results"}
            </div>
            <div className="catalog-modal__grid">
              {filteredEntries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="catalog-modal__entry"
                  onClick={() => onSelect?.(e)}
                  title={e.id}
                >
                  <div className="catalog-modal__icon">
                    <img src={e.path} alt="" draggable={false} />
                  </div>
                  <div className="catalog-modal__label">{entryLabel(e, providerKey)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* Must be above DiagramEditor modals (e.g. Properties modal uses z-index: 10001). */
        .catalog-modal__overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.50); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 10020; }
        .catalog-modal__panel { width: min(1100px, 100%); max-height: min(760px, 92vh); background: #ffffff; border-radius: 16px; border: 1px solid rgba(148, 163, 184, 0.55); box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35); display: flex; flex-direction: column; overflow: hidden; }
        .catalog-modal__header { padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; }
        .catalog-modal__title { font-weight: 900; color: #0f172a; }
        .catalog-modal__search { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
        .catalog-modal__search input { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; }
        .catalog-modal__body { display: grid; gap: 0; flex: 1; min-height: 0; }
        .catalog-modal__services { border-right: 1px solid #e2e8f0; padding: 12px; overflow: auto; }
        .catalog-modal__entries { padding: 12px; overflow: auto; min-height: 0; }
        .catalog-modal__sectionTitle { font-size: 12px; font-weight: 900; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        .catalog-modal__serviceList { display: flex; flex-direction: column; gap: 6px; }
        .catalog-modal__service { text-align: left; padding: 8px 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #ffffff; font-weight: 800; color: #0f172a; }
        .catalog-modal__service:hover { background: #f8fafc; border-color: #94a3b8; }
        .catalog-modal__service.active { border-color: rgba(14, 165, 233, 0.75); background: rgba(14, 165, 233, 0.08); }
        .catalog-modal__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
        .catalog-modal__entry { display: grid; grid-template-columns: 48px 1fr; gap: 10px; padding: 10px; border-radius: 12px; border: 1px solid #e2e8f0; background: #ffffff; text-align: left; }
        .catalog-modal__entry:hover { border-color: #94a3b8; background: #f8fafc; }
        .catalog-modal__icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; }
        .catalog-modal__icon img { width: 100%; height: 100%; object-fit: contain; }
        .catalog-modal__label { font-weight: 900; color: #0f172a; font-size: 13px; line-height: 1.15; }
      `}</style>
    </div>
  );
}
