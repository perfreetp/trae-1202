import { create } from 'zustand';
import type { CsvFile, DataRow } from '../engine/types';
import { produce } from 'immer';
import { recalcMeta } from '../engine/cleaner';
import { finalizeTransform } from '../engine/transformer';

interface FileState {
  files: CsvFile[];
  activeFileId: string | null;
  snapshots: Record<string, CsvFile[]>;
  selectedRowIds: Set<string>;
  selectedColumn: string | null;
}

interface FileActions {
  addFile: (file: CsvFile) => void;
  removeFile: (id: string) => void;
  setActiveFile: (id: string | null) => void;
  getActiveFile: () => CsvFile | undefined;
  updateActiveFile: (updater: (f: CsvFile) => CsvFile, pushSnapshot?: boolean) => void;
  updateFile: (id: string, updater: (f: CsvFile) => CsvFile, pushSnapshot?: boolean) => void;
  undo: () => void;
  redo: () => void;
  setSelectedRows: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  toggleSelectRow: (id: string) => void;
  selectAllRows: () => void;
  clearSelection: () => void;
  setSelectedColumn: (col: string | null) => void;
  finalizeActiveFile: () => void;
}

export type FileStore = FileState & FileActions;

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  activeFileId: null,
  snapshots: {},
  selectedRowIds: new Set(),
  selectedColumn: null,

  addFile: (file) =>
    set((s) => {
      const finalized = finalizeTransform(recalcMeta(file));
      return {
        files: [...s.files, finalized],
        activeFileId: s.activeFileId || finalized.id,
        snapshots: { ...s.snapshots, [finalized.id]: [] },
        selectedRowIds: new Set(),
      };
    }),

  removeFile: (id) =>
    set((s) => {
      const remaining = s.files.filter((f) => f.id !== id);
      const nextSnapshots = { ...s.snapshots };
      delete nextSnapshots[id];
      return {
        files: remaining,
        activeFileId: s.activeFileId === id ? (remaining[0]?.id ?? null) : s.activeFileId,
        snapshots: nextSnapshots,
      };
    }),

  setActiveFile: (id) => set({ activeFileId: id, selectedRowIds: new Set(), selectedColumn: null }),

  getActiveFile: () => {
    const state = get();
    return state.files.find((f) => f.id === state.activeFileId);
  },

  updateActiveFile: (updater, pushSnapshot = true) => {
    const state = get();
    if (!state.activeFileId) return;
    state.updateFile(state.activeFileId, updater, pushSnapshot);
  },

  updateFile: (id, updater, pushSnapshot = true) => {
    set((s) => {
      const file = s.files.find((f) => f.id === id);
      if (!file) return {};
      const updatedFile = updater(file);
      const newFile = finalizeTransform(recalcMeta(updatedFile));
      const newSnapshots = pushSnapshot
        ? { ...s.snapshots, [id]: [...(s.snapshots[id] || []), file] }
        : s.snapshots;
      return {
        files: s.files.map((f) => (f.id === id ? newFile : f)),
        snapshots: newSnapshots,
      };
    });
  },

  undo: () => {
    const state = get();
    if (!state.activeFileId) return;
    const snaps = state.snapshots[state.activeFileId] || [];
    if (snaps.length === 0) return;
    const prev = snaps[snaps.length - 1];
    set((s) => ({
      files: s.files.map((f) => (f.id === state.activeFileId ? prev : f)),
      snapshots: { ...s.snapshots, [state.activeFileId!]: snaps.slice(0, -1) },
    }));
  },

  redo: () => {},

  setSelectedRows: (ids) =>
    set((s) => ({
      selectedRowIds: typeof ids === 'function' ? ids(s.selectedRowIds) : ids,
    })),

  toggleSelectRow: (id) =>
    set((s) => {
      const n = new Set(s.selectedRowIds);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return { selectedRowIds: n };
    }),

  selectAllRows: () => {
    const f = get().getActiveFile();
    if (!f) return;
    set({ selectedRowIds: new Set(f.rows.map((r) => r._id)) });
  },

  clearSelection: () => set({ selectedRowIds: new Set() }),

  setSelectedColumn: (col) => set({ selectedColumn: col }),

  finalizeActiveFile: () => {
    get().updateActiveFile((f) => finalizeTransform(recalcMeta(f)), true);
  },
}));
