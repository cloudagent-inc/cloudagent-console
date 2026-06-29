import { memo, useMemo, useState } from "react";
import { Handle, Position } from "reactflow";
import { shortKind } from "./icons";

export const CloudNode = memo(function CloudNode({ data }) {
  const [iconMode, setIconMode] = useState("primary"); // primary | fallback | none

  const label = String(data?.label || "").trim() || String(data?.kind || "").trim() || "Node";
  const iconSrc = data?.iconSrc || null;
  const fallbackIconSrc = data?.fallbackIconSrc || null;

  const effectiveSrc =
    iconMode === "primary"
      ? iconSrc || fallbackIconSrc
      : iconMode === "fallback"
        ? fallbackIconSrc
        : null;
  const showImg = Boolean(effectiveSrc);

  const glyph = useMemo(() => shortKind(label).slice(0, 4), [label]);

  return (
    <div className="cloud-node">
      <Handle id="t" type="target" position={Position.Top} />
      <Handle id="l" type="target" position={Position.Left} />
      <Handle id="b" type="target" position={Position.Bottom} />
      <Handle id="r" type="target" position={Position.Right} />
      <div className="cloud-node__inner">
        <div className="cloud-node__icon">
          {showImg ? (
            <img
              src={effectiveSrc}
              alt=""
              onError={() => {
                if (iconMode === "primary" && fallbackIconSrc) return setIconMode("fallback");
                setIconMode("none");
              }}
              draggable={false}
            />
          ) : (
            <div className="cloud-node__glyph" aria-hidden="true">
              {glyph || "•"}
            </div>
          )}
        </div>
        <div className="cloud-node__label">{label}</div>
      </div>
      <Handle id="t" type="source" position={Position.Top} />
      <Handle id="l" type="source" position={Position.Left} />
      <Handle id="b" type="source" position={Position.Bottom} />
      <Handle id="r" type="source" position={Position.Right} />
    </div>
  );
});
