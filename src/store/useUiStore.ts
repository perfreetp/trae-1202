import { create } from 'zustand';
import type { ModuleId, ToastMessage } from '../engine/types';
import { generateId } from '../utils/detectType';

interface UiState {
  activeModule: ModuleId;
  sidebarCollapsed: boolean;
  historyDrawerOpen: boolean;
  compareFileId: string | null;
  toasts: ToastMessage[];
  modal: null | { type: 'save-template' | 'filter' | 'formula' | 'export' | 'locate-error'; data?: unknown };
}

interface UiActions {
  setActiveModule: (m: ModuleId) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setHistoryDrawerOpen: (v: boolean) => void;
  setCompareFileId: (id: string | null) => void;
  showToast: (t: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  openModal: (type: UiState['modal'] extends null ? never : NonNullable<UiState['modal']>['type'], data?: unknown) => void;
  closeModal: () => void;
}

export type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>((set) => ({
  activeModule: 'files',
  sidebarCollapsed: false,
  historyDrawerOpen: false,
  compareFileId: null,
  toasts: [],
  modal: null,

  setActiveModule: (m) => set({ activeModule: m }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  setHistoryDrawerOpen: (v) => set({ historyDrawerOpen: v }),

  setCompareFileId: (id) => set({ compareFileId: id }),

  showToast: (t) => {
    const id = generateId();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    const duration = t.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
      }, duration);
    }
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  openModal: (type, data) => set({ modal: { type, data } }),
  closeModal: () => set({ modal: null }),
}));
