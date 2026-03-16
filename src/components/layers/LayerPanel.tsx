import { C, ELEMENT_COLORS } from '../../theme/colors';
import { LAYER_PANEL_WIDTH } from '../../theme/tokens';
import { useElementStore } from '../../store/elementStore';
import type { Element } from '../../types';

export function LayerPanel() {
  const elements = useElementStore((s) => s.elements);
  const selectedIds = useElementStore((s) => s.selectedIds);
  const selectElement = useElementStore((s) => s.selectElement);

  const getLabel = (el: Element) => {
    if (el.type === 'text') return el.content.slice(0, 16);
    return el.name || el.type;
  };

  return (
    <div
      style={{
        width: LAYER_PANEL_WIDTH,
        minHeight: 0,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          padding: '16px 14px 12px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: C.copper,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            fontWeight: 700,
            marginBottom: 5,
          }}
        >
          Assembly Stack
        </div>
        <div style={{ fontSize: 14, color: C.text, fontWeight: 700, marginBottom: 3 }}>
          Layers
        </div>
        <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
          Review the visual stack feeding the final timeline.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {[...elements].reverse().map((el) => (
          <div
            key={el.id}
            onClick={(e) => selectElement(el.id, e.shiftKey)}
            style={{
              padding: '10px 12px',
              background: selectedIds.has(el.id) ? `${C.accent}14` : 'transparent',
              borderBottom: `1px solid ${C.border}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              opacity: el.visible ? 1 : 0.45,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: el.type === 'circle' ? 5 : 2,
                background: ELEMENT_COLORS[el.type] || C.accent,
                flexShrink: 0,
                boxShadow: `0 0 12px ${(ELEMENT_COLORS[el.type] || C.accent)}55`,
              }}
            />
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                color: selectedIds.has(el.id) ? C.text : C.textDim,
                fontWeight: selectedIds.has(el.id) ? 600 : 500,
              }}
            >
              {getLabel(el)}
            </span>
            {el.locked && <span style={{ fontSize: 9, color: C.textMuted }}>LOCK</span>}
            {el.animation !== 'none' && (
              <span style={{ fontSize: 9, color: C.accent }}>FX</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
