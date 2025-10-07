/**
 * FleetFlow - Fleet Expense Management Mobile App
 * React Native + TypeScript
 *
 * @format
 */

import React, { useEffect } from "react";
import { Platform, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "./src/i18n/index"; // Initialize i18n
import { AuthProvider } from "./src/state/authSlice";
import { ExpenseProvider } from "./src/state/expenseSlice";
import Navigation from "./src/navigation";
import { request, check, PERMISSIONS } from "react-native-permissions";
import RNBootSplash from "react-native-bootsplash";

function App(): React.JSX.Element {
  // Optional: You can check permissions status on app start without requesting them
  // This helps avoid iOS permission prompt fatigue
  async function checkPermissionsStatus() {
    try {
      if (Platform.OS === "android") {
        const cameraPermission = await check(PERMISSIONS.ANDROID.CAMERA);
        const photoPermission =
          Platform.Version >= 33
            ? await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES)
            : await check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);

        console.log(
          "Permission status - Camera:",
          cameraPermission,
          "Photos:",
          photoPermission
        );
      } else if (Platform.OS === "ios") {
        const cameraPermission = await check(PERMISSIONS.IOS.CAMERA);
        const photoPermission = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);

        console.log(
          "Permission status - Camera:",
          cameraPermission,
          "Photos:",
          photoPermission
        );
      }
    } catch (error) {
      console.log("Error checking permissions:", error);
    }
  }

  const init = async () => {
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    await RNBootSplash.hide({ fade: true }); // fade optional
  };

  useEffect(() => {
    // init();
    checkPermissionsStatus();
  }, []);

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
