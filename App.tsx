/**
 * FleetFlow - Fleet Expense Management Mobile App
 * React Native + TypeScript
 *
 * @format
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/state/authSlice';
import { ExpenseProvider } from './src/state/expenseSlice';
import Navigation from './src/navigation';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AuthProvider>
        <ExpenseProvider>
          <Navigation />
        </ExpenseProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
