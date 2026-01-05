import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface TaxYearContextType {
  taxYear: number;
  setTaxYear: (year: number) => Promise<void>;
  isLoading: boolean;
}

const TaxYearContext = createContext<TaxYearContextType | undefined>(undefined);

const TAX_YEAR_STORAGE_KEY = '@tax_year';

export function TaxYearProvider({ children }: { children: React.ReactNode }) {
  const [taxYear, setTaxYearState] = useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTaxYear();
  }, []);

  const loadTaxYear = async () => {
    try {
      const storedYear = await AsyncStorage.getItem(TAX_YEAR_STORAGE_KEY);
      if (storedYear) {
        setTaxYearState(parseInt(storedYear, 10));
      }
    } catch (error) {
      console.error('Error loading tax year:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTaxYear = async (year: number) => {
    try {
      await AsyncStorage.setItem(TAX_YEAR_STORAGE_KEY, year.toString());
      setTaxYearState(year);
    } catch (error) {
      console.error('Error saving tax year:', error);
    }
  };

  return (
    <TaxYearContext.Provider value={{ taxYear, setTaxYear, isLoading }}>
      {children}
    </TaxYearContext.Provider>
  );
}

export function useTaxYear() {
  const context = useContext(TaxYearContext);
  if (context === undefined) {
    throw new Error('useTaxYear must be used within a TaxYearProvider');
  }
  return context;
}

