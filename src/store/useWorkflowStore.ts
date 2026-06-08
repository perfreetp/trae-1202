import { create } from 'zustand';
import type { WorkflowStep, WorkflowTemplate, CsvFile } from '../engine/types';
import { generateId } from '../utils/detectType';
import { useFileStore } from './useFileStore';
import * as cleaner from '../engine/cleaner';
import * as transformer from '../engine/transformer';
import * as differ from '../engine/differ';
import * as parser from '../engine/parser';
import type { FilterCondition } from '../engine/types';

interface WorkflowState {
  steps: WorkflowStep[];
  templates: WorkflowTemplate[];
  isPlaying: boolean;
  currentStepIndex: number;
}

interface WorkflowActions {
  addStep: (step: Omit<WorkflowStep, 'id' | 'timestamp'>) => void;
  removeStep: (id: string) => void;
  clearSteps: () => void;
  saveTemplate: (name: string, description?: string) => WorkflowTemplate;
  deleteTemplate: (id: string) => void;
  loadTemplate: (id: string) => void;
  executeStep: (step: WorkflowStep) => boolean;
  playAll: () => Promise<boolean>;
  playStep: (id: string) => boolean;
  setCurrentStepIndex: (i: number) => void;
  exportTemplate: (id: string) => string;
  importTemplate: (json: string) => WorkflowTemplate | null;
}

export type WorkflowStore = WorkflowState & WorkflowActions;

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  steps: [],
  templates: [],
  isPlaying: false,
  currentStepIndex: -1,

  addStep: (step) =>
    set((s) => ({
      steps: [
        ...s.steps,
        {
          ...step,
          id: generateId(),
          timestamp: Date.now(),
        },
      ],
    })),

  removeStep: (id) => set((s) => ({ steps: s.steps.filter((x) => x.id !== id) })),

  clearSteps: () => set({ steps: [], currentStepIndex: -1 }),

  saveTemplate: (name, description = '') => {
    const tpl: WorkflowTemplate = {
      id: generateId(),
      name,
      description,
      steps: get().steps,
      createdAt: Date.now(),
      usageCount: 0,
    };
    set((s) => ({ templates: [...s.templates, tpl] }));
    return tpl;
  },

  deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

  loadTemplate: (id) => {
    const tpl = get().templates.find((t) => t.id === id);
    if (tpl) {
      set({ steps: [...tpl.steps], currentStepIndex: -1 });
      set((s) => ({
        templates: s.templates.map((t) => (t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t)),
      }));
    }
  },

  executeStep: (step) => {
    const fileStore = useFileStore.getState();
    const file = fileStore.getActiveFile();
    if (!file && step.type !== 'IMPORT') return false;

    try {
      const p = step.payload;
      switch (step.type) {
        case 'MARK_NULL':
          fileStore.updateActiveFile((f) => cleaner.markNulls(f, p.columns as string[], p.marker as string));
          return true;
        case 'REMOVE_NULL':
          fileStore.updateActiveFile((f) => cleaner.removeNulls(f, p.columns as string[], p.mode as 'any' | 'all'));
          return true;
        case 'REMOVE_DUPLICATES':
          fileStore.updateActiveFile((f) =>
            cleaner.removeDuplicates(f, p.columns as string[], (p.keepFirst as boolean) ?? true)
          );
          return true;
        case 'REPLACE':
          fileStore.updateActiveFile((f) =>
            cleaner.bulkReplace(f, p.column as string, p.find as string, p.replace as string, p.regex as boolean)
          );
          return true;
        case 'FILTER':
          fileStore.updateActiveFile((f) =>
            cleaner.filterRows(f, p.conditions as FilterCondition[], (p.logic as 'AND' | 'OR') || 'AND')
          );
          return true;
        case 'SPLIT_COLUMN':
          fileStore.updateActiveFile((f) =>
            transformer.splitColumn(f, p.source as string, p.delimiter as string, p.targets as string[])
          );
          return true;
        case 'MERGE_COLUMNS':
          fileStore.updateActiveFile((f) =>
            transformer.mergeColumns(
              f,
              p.sources as string[],
              p.target as string,
              p.separator as string,
              (p.keepOriginal as boolean) ?? false
            )
          );
          return true;
        case 'FORMULA_COLUMN': {
          fileStore.updateActiveFile((f) => {
            const { file: newF } = transformer.addFormulaColumn(f, p.target as string, p.expression as string);
            return newF;
          });
          return true;
        }
        case 'CONVERT_TYPE':
          fileStore.updateActiveFile((f) =>
            transformer.convertType(f, p.column as string, p.toType as any, p.format as string)
          );
          return true;
        case 'COMPARE': {
          const files = fileStore.files;
          const otherFile = files.find((ff) => ff.id === p.otherFileId);
          const active = fileStore.getActiveFile();
          if (!otherFile || !active) return false;
          const result = differ.mergeFiles(active, otherFile, p.keys as string[], p.mode as any);
          fileStore.addFile(result.file);
          return true;
        }
        case 'EXPORT':
          return true;
        default:
          return false;
      }
    } catch {
      return false;
    }
  },

  playAll: async () => {
    set({ isPlaying: true, currentStepIndex: -1 });
    const steps = get().steps;
    for (let i = 0; i < steps.length; i++) {
      set({ currentStepIndex: i });
      const ok = get().executeStep(steps[i]);
      await new Promise((r) => setTimeout(r, 120));
      if (!ok) {
        set({ isPlaying: false });
        return false;
      }
    }
    set({ isPlaying: false });
    return true;
  },

  playStep: (id) => {
    const step = get().steps.find((s) => s.id === id);
    if (!step) return false;
    return get().executeStep(step);
  },

  setCurrentStepIndex: (i) => set({ currentStepIndex: i }),

  exportTemplate: (id) => {
    const tpl = get().templates.find((t) => t.id === id);
    return tpl ? JSON.stringify(tpl, null, 2) : '';
  },

  importTemplate: (json) => {
    try {
      const tpl = JSON.parse(json) as WorkflowTemplate;
      if (!tpl.id || !tpl.name || !Array.isArray(tpl.steps)) return null;
      set((s) => ({ templates: [...s.templates, tpl] }));
      return tpl;
    } catch {
      return null;
    }
  },
}));
