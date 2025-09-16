import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ExpensesListScreen from '../screens/History/ExpensesListScreen';
import ExpenseDetailScreen from '../screens/History/ExpenseDetailScreen';
import { theme } from '../styles/theme';

export type HistoryStackParamList = {
  ExpensesList: undefined;
  ExpenseDetail: { expenseId: string };
};

const Stack = createStackNavigator<HistoryStackParamList>();

const HistoryStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text,
          fontSize: theme.fontSize.title,
          fontWeight: '600',
        },
        headerTintColor: theme.colors.primary,
        cardStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen
        name="ExpensesList"
        component={ExpensesListScreen}
        options={{
          title: 'Expense History',
        }}
      />
      <Stack.Screen
        name="ExpenseDetail"
        component={ExpenseDetailScreen}
        options={{
          title: 'Expense Details',
        }}
      />
    </Stack.Navigator>
  );
};

export default HistoryStack;