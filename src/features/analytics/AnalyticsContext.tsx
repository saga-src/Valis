
import React, { createContext, useContext, useState } from "react";

interface AnalyticsFilterState {
  timeRange: "all" | "year" | "month";
  genre: string | null;
  status: string | null;
  excludeFree: boolean;
  officialOnly: boolean;
}

interface AnalyticsContextType {
  filters: AnalyticsFilterState;
  setFilters: React.Dispatch<React.SetStateAction<AnalyticsFilterState>>;
}

export const AnalyticsFilterContext = createContext<AnalyticsContextType | undefined>(undefined);

export const useAnalyticsFilters = () => {
  const context = useContext(AnalyticsFilterContext);
  if (!context) {
    throw new Error("useAnalyticsFilters must be used within an AnalyticsProvider");
  }
  return context;
};

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    timeRange: "all",
    genre: null,
    status: null,
    excludeFree: false,
    officialOnly: false,
  });

  return (
    <AnalyticsFilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </AnalyticsFilterContext.Provider>
  );
};
