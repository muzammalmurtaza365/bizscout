import { create } from 'zustand';
import type { ResponseRecord } from '../types/api';

interface ResponsesState {
  items: ResponseRecord[];
  maxItems: number;
  setItems: (items: ResponseRecord[]) => void;
  prependItem: (item: ResponseRecord) => void;
  clear: () => void;
}

export const useResponsesStore = create<ResponsesState>((set, get) => ({
  items: [],
  maxItems: 200,
  setItems: (items) => set({ items }),
  prependItem: (item) => {
    const { items, maxItems } = get();
    if (items.some((existing) => existing._id === item._id)) return;
    set({ items: [item, ...items].slice(0, maxItems) });
  },
  clear: () => set({ items: [] }),
}));
