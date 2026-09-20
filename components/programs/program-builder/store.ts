'use client';
import { create } from 'zustand';
import type { WizardData } from './types';
import { getDefaultWizardData, TOTAL_STEPS } from './types';

interface WizardStore {
  step: number;
  data: WizardData;
  setStep: (s: number) => void;
  next: () => void;
  back: () => void;
  updateBasic: (patch: Partial<WizardData['basic']>) => void;
  updateVerification: (patch: Partial<WizardData['verification']>) => void;
  updateScope: (patch: Partial<WizardData['scope']>) => void;
  updateRules: (patch: Partial<WizardData['rules']>) => void;
  updateRewards: (patch: Partial<WizardData['rewards']>) => void;
  updateSLA: (patch: Partial<WizardData['sla']>) => void;
  updateDisclosure: (patch: Partial<WizardData['disclosure']>) => void;
  setData: (d: WizardData) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardStore>((set) => ({
  step: 1,
  data: getDefaultWizardData(),
  setStep: (step) => set({ step: Math.max(1, Math.min(TOTAL_STEPS, step)) }),
  next: () => set((s) => ({ step: Math.min(TOTAL_STEPS, s.step + 1) })),
  back: () => set((s) => ({ step: Math.max(1, s.step - 1) })),
  updateBasic: (patch) => set((s) => ({ data: { ...s.data, basic: { ...s.data.basic, ...patch } } })),
  updateVerification: (patch) => set((s) => ({ data: { ...s.data, verification: { ...s.data.verification, ...patch } } })),
  updateScope: (patch) => set((s) => ({ data: { ...s.data, scope: { ...s.data.scope, ...patch } } })),
  updateRules: (patch) => set((s) => ({ data: { ...s.data, rules: { ...s.data.rules, ...patch } } })),
  updateRewards: (patch) => set((s) => ({ data: { ...s.data, rewards: { ...s.data.rewards, ...patch } } })),
  updateSLA: (patch) => set((s) => ({ data: { ...s.data, sla: { ...s.data.sla, ...patch } } })),
  updateDisclosure: (patch) => set((s) => ({ data: { ...s.data, disclosure: { ...s.data.disclosure, ...patch } } })),
  setData: (d) => set({ data: d }),
  reset: () => set({ step: 1, data: getDefaultWizardData() }),
}));
