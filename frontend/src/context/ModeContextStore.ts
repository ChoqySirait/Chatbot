import { createContext } from 'react';

export type UserMode = 'consumer' | 'analyst';

export interface ModeContextType {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  toggleMode: () => void;
}

export const ModeContext = createContext<ModeContextType | undefined>(undefined);
