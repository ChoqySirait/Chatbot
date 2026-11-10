import React, { createContext, useContext, useState } from 'react';

export type UserMode = 'consumer' | 'analyst';

interface ModeContextType {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<UserMode>(() => {
    const saved = localStorage.getItem('securai_user_mode') as UserMode;
    return saved === 'analyst' ? 'analyst' : 'consumer';
  });

  const setMode = (newMode: UserMode) => {
    setModeState(newMode);
    localStorage.setItem('securai_user_mode', newMode);
  };

  const toggleMode = () => {
    setMode(mode === 'consumer' ? 'analyst' : 'consumer');
  };

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = (): ModeContextType => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};
