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
import { request, PERMISSIONS, RESULTS } from "react-native-permissions";


function App(): React.JSX.Element {
  async function requestPermissions() {
    if (Platform.OS === "android") {
      if (Platform.Version >= 33) {
        // Android 13+
        const cameraStatus = await request(PERMISSIONS.ANDROID.CAMERA);
        const imagesStatus = await request(
          PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
        );

        console.log("Camera:", cameraStatus);
        console.log("Read Media Images:", imagesStatus);

        // WRITE_EXTERNAL_STORAGE is deprecated on Android 13+
      } else {
        // Below Android 13
        const cameraStatus = await request(PERMISSIONS.ANDROID.CAMERA);
        const readStorageStatus = await request(
          PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE
        );
        const writeStorageStatus = await request(
          PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE
        );

        console.log("Camera:", cameraStatus);
        console.log("Read External Storage:", readStorageStatus);
        console.log("Write External Storage:", writeStorageStatus);
      }
    } else if (Platform.OS === "ios") {
      const cameraStatus = await request(PERMISSIONS.IOS.CAMERA);
      const photoLibraryStatus = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      // For iOS 14+, you can also request PHOTO_LIBRARY_ADD_ONLY if needed

      console.log("Camera:", cameraStatus);
      console.log("Photo Library:", photoLibraryStatus);
    }
  }

  useEffect(() => {
    requestPermissions();
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
