import React, { ReactNode } from 'react';
import { AuthProvider } from './authSlice';
import { ExpenseProvider } from './expenseSlice';

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <ExpenseProvider>
        {children}
      </ExpenseProvider>
    </AuthProvider>
  );
};