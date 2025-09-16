import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../state/authSlice';
import AuthStack from './AuthStack';
import AppTabs from './AppTabs';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

const Navigation: React.FC = () => {
  const { state } = useAuth();

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {state.isAuthenticated ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});

export default Navigation;