import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../state/authSlice";
import AuthStack from "./AuthStack";
import AppTabs from "./AppTabs";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { theme } from "../styles/theme";
import RNBootSplash from "react-native-bootsplash";
import SplashScreen from "../components/SplashScreen";

const Navigation: React.FC = () => {
  const { state } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Wait for native bootsplash to finish rendering before showing animation
    RNBootSplash.hide({ fade: true });
  }, []);

  const handleSplashAnimationEnd = () => {
    setShowSplash(false);
  };

  // useEffect(() => {
  //   const init = async () => {
  //     if (!state.isLoading) await RNBootSplash.hide({ fade: true });
  //     // Simulate some async startup work (like fetching data)
  //     // await new Promise((resolve) => setTimeout(resolve, 1000));
  //     // Hide the splash screen
  //     // await RNBootSplash.hide({ fade: true }); // fade optional
  //   };
  //   init();
  // }, [state.isLoading]);

  if (state.isLoading) {
    return (
      // <SplashScreen onAnimationEnd={handleSplashAnimationEnd} />
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
});

export default Navigation;
