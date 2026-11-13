'use client';
import { createContext, useContext } from 'react';
import type { Notify } from './ui';

export type Tab = 'chats' | 'explore' | 'publish' | 'purchases' | 'profile';

export interface AcContext {
  me: any;
  reloadMe: () => Promise<void>;
  notify: Notify;
  openChat: (cid: string) => void;
  openPost: (pid: string) => void;
  openOrder: (oid: string) => void;
  openProfile: (uid: string) => void;
  publishIn: (cid: string | null) => void;
  setTab: (tab: Tab) => void;
}
export const AcCtx = createContext<AcContext>(null as any);
export const useAc = () => useContext(AcCtx);
