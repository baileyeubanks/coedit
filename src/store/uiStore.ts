import { create } from 'zustand';

export type PanelTab = 'properties' | 'animate' | 'filters';

// NLE editing tools
export type TimelineTool = 'select' | 'blade' | 'ripple' | 'roll' | 'slide' | 'slip';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetId: string | null;
  targetType: 'element' | 'clip' | 'canvas' | 'media' | null;
}

interface UIState {
  activeTab: PanelTab;
  showGrid: boolean;
  showMediaBin: boolean;
  showSubtitleEditor: boolean;
  showAutoCut: boolean;
  contextMenu: ContextMenuState;
  zoom: number;
  exportDialogOpen: boolean;
  timelineTool: TimelineTool;
}

interface UIActions {
  setActiveTab: (tab: PanelTab) => void;
  toggleGrid: () => void;
  toggleMediaBin: () => void;
  toggleSubtitleEditor: () => void;
  toggleAutoCut: () => void;
  openContextMenu: (x: number, y: number, targetId: string | null, targetType: ContextMenuState['targetType']) => void;
  closeContextMenu: () => void;
  setZoom: (z: number) => void;
  setExportDialogOpen: (open: boolean) => void;
  setTimelineTool: (tool: TimelineTool) => void;
}

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()((set) => ({
  activeTab: 'properties',
  showGrid: true,
  showMediaBin: true,
  showSubtitleEditor: false,
  showAutoCut: false,
  contextMenu: { visible: false, x: 0, y: 0, targetId: null, targetType: null },
  zoom: 1,
  exportDialogOpen: false,
  timelineTool: 'select',

  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleMediaBin: () => set((s) => ({ showMediaBin: !s.showMediaBin })),
  toggleSubtitleEditor: () => set((s) => ({ showSubtitleEditor: !s.showSubtitleEditor })),
  toggleAutoCut: () => set((s) => ({ showAutoCut: !s.showAutoCut })),

  openContextMenu: (x, y, targetId, targetType) =>
    set({ contextMenu: { visible: true, x, y, targetId, targetType } }),

  closeContextMenu: () =>
    set((s) => ({ contextMenu: { ...s.contextMenu, visible: false } })),

  setZoom: (z) => set({ zoom: Math.max(0.2, Math.min(3, z)) }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setTimelineTool: (tool) => set({ timelineTool: tool }),
}));
