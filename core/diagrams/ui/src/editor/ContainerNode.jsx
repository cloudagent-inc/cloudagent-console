import { memo } from "react";
import { NodeResizer } from "reactflow";
import { shortKind } from "./icons";

export const ContainerNode = memo(function ContainerNode({ data, selected }) {
  const label = String(data?.label || "").trim() || "Container";
  const bg = data?.containerBg || "rgba(226, 232, 240, 0.20)";
  const border = data?.containerBorder || "rgba(148, 163, 184, 0.85)";
  const iconSrc = data?.iconSrc || data?.fallbackIconSrc || null;
  const glyph = shortKind(label).slice(0, 3);
  const maxW = Number.isFinite(Number(data?.resizeMaxW)) ? Number(data.resizeMaxW) : undefined;
  const maxH = Number.isFinite(Number(data?.resizeMaxH)) ? Number(data.resizeMaxH) : undefined;
  const minW0 = Number.isFinite(Number(data?.resizeMinW)) ? Number(data.resizeMinW) : 360;
  const minH0 = Number.isFinite(Number(data?.resizeMinH)) ? Number(data.resizeMinH) : 220;
  const minW = Math.min(minW0, maxW || minW0);
  const minH = Math.min(minH0, maxH || minH0);
  const canResize = !data?.disableResize;

  return (
    <div className="container-node" style={{ background: bg, borderColor: border }}>
      <NodeResizer
        isVisible={Boolean(selected) && canResize}
        minWidth={minW}
        minHeight={minH}
        {...(maxW ? { maxWidth: maxW } : {})}
        {...(maxH ? { maxHeight: maxH } : {})}
        handleStyle={{ width: 10, height: 10, borderRadius: 6 }}
        lineStyle={{ borderColor: "rgba(14, 165, 233, 0.65)" }}
      />
      <div className="container-node__header">
        <div className="container-node__title">
          <div className="container-node__titleIcon" aria-hidden="true">
            {iconSrc ? <img src={iconSrc} alt="" draggable={false} /> : <span>{glyph || "•"}</span>}
          </div>
          <div className="container-node__label">{label}</div>
        </div>
      </div>
      <div className="container-node__body" />
    </div>
  );
});
