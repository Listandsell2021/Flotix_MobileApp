
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from "react-i18next";
import UploadReceiptScreen from '../screens/Create/UploadReceiptScreen';
import ExpenseFormScreen from '../screens/Create/ExpenseFormScreen';
import MultiUploadScreen from '../screens/Create/MultiUploadScreen';
import { theme } from '../styles/theme';

export type CreateStackParamList = {
  UploadReceipt: undefined;
  ExpenseForm: { receiptUrl?: string };
  MultiUpload: undefined;

};

const Stack = createStackNavigator<CreateStackParamList>();

const CreateStack: React.FC = () => {
  const { t } = useTranslation();

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
          fontWeight: "600",
        },
        headerTintColor: theme.colors.primary,
      }}
      initialRouteName="UploadReceipt"
    >
      <Stack.Screen
        name="UploadReceipt"
        component={UploadReceiptScreen}
        options={{ title: t("navigation.createExpense") }}
      />
      <Stack.Screen
        name="ExpenseForm"
        component={ExpenseFormScreen}
        options={{ title: t("navigation.expenseDetails") }}
      />
      <Stack.Screen
        name="MultiUpload"
        component={MultiUploadScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default CreateStack;
