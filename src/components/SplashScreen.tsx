import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  Animated,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
} from "react-native";
import RNBootSplash from "react-native-bootsplash";

const SplashScreen = ({ onAnimationEnd }: { onAnimationEnd: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate logo
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start(() => {
      setTimeout(onAnimationEnd, 300); // Wait a bit before hiding splash
    });
  }, []);

  return (
    <View style={styles.splash}>
      <Animated.Image
        source={require("../assets/appLogo.png")}
        style={[styles.logo, { transform: [{ scale: scaleAnim }] }]}
        resizeMode="contain"
      />
      <Text>Checking</Text>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#FFFFFF", // Match native splash
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
});
