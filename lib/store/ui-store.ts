'use client'
import { create } from 'zustand';
type S={sidebar:boolean;locale:'ar'|'en';toggle:()=>void;setLocale:(l:'ar'|'en')=>void};
export const useUI=create<S>((set)=>({sidebar:true,locale:'ar',toggle:()=>set((s)=>({sidebar:!s.sidebar})),setLocale:(locale)=>set({locale})}));
