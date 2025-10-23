import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RSpaceConfig {
  baseUrl: string;
  apiKey: string;
}

interface RSpaceConfigContextType {
  config: RSpaceConfig | null;
  setConfig: (config: RSpaceConfig | null) => void;
  isConfigured: boolean;
}

const RSpaceConfigContext = createContext<RSpaceConfigContextType | undefined>(undefined);

export function RSpaceConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<RSpaceConfig | null>(null);

  return (
    <RSpaceConfigContext.Provider
      value={{
        config,
        setConfig,
        isConfigured: config !== null && config.baseUrl !== '' && config.apiKey !== '',
      }}
    >
      {children}
    </RSpaceConfigContext.Provider>
  );
}

export function useRSpaceConfig() {
  const context = useContext(RSpaceConfigContext);
  if (context === undefined) {
    throw new Error('useRSpaceConfig must be used within a RSpaceConfigProvider');
  }
  return context;
}
