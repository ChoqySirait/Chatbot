import React, { useState } from 'react';
import { ModeContext, type UserMode } from './ModeContextStore';

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
