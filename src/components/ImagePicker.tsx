import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
} from "react-native-image-picker";
import { theme } from "../styles/theme";
import Button from "./Button";
import { useTranslation } from "react-i18next";
import { permissionManager } from "../utils/permissions";

interface ImagePickerProps {
  onImageSelected: (uri: string) => void;
  selectedImageUri?: string;
}

const ImagePicker: React.FC<ImagePickerProps> = ({
  onImageSelected,
  selectedImageUri,
}) => {
  const { t } = useTranslation();

  const selectImage = () => {
    Alert.alert(
      t("upload.selectImage"),
      t("upload.chooseOption"),
      [
        { text: t("upload.camera"), onPress: openCamera },
        { text: t("upload.photoLibrary"), onPress: openImageLibrary },
        { text: t("upload.cancel"), style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const openCamera = async () => {
    try {
      console.log('Requesting camera permission...');
      const permissionResult = await permissionManager.requestPermission('camera');

      if (!permissionResult.granted) {
        console.log('Camera permission not granted:', permissionResult.message);
        if (permissionResult.message && !permissionResult.shouldShowSettings) {
          Alert.alert(
            t("permissions.cameraRequired"),
            permissionResult.message
          );
        }
        return;
      }

      console.log('Camera permission granted, launching camera...');

      // Permission granted, launch camera
      const options = {
        mediaType: "photo" as MediaType,
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 0.8 as any,
        saveToPhotos: false, // Don't save to photos automatically
      };

      launchCamera(options, handleResponse);
    } catch (error) {
      console.error('Camera launch error:', error);
      Alert.alert(
        t("common.error"),
        t("permissions.cameraError")
      );
    }
  };

  const openImageLibrary = async () => {
    try {
      console.log('Launching photo picker...');

      // Use photo picker - no permissions needed on modern Android
      const options = {
        mediaType: "photo" as MediaType,
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 0.8 as any,
        selectionLimit: 1, // Limit to 1 image
        presentationStyle: 'fullScreen' as any,
      };

      launchImageLibrary(options, handleResponse);
    } catch (error) {
      console.error('Photo picker launch error:', error);
      Alert.alert(
        t("common.error"),
        t("common.unknownError")
      );
    }
  };

  const handleResponse = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorMessage) {
      return;
    }

    if (response.assets && response.assets[0]) {
      const asset = response.assets[0];
      if (asset.uri) {
        onImageSelected(asset.uri);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t("upload.receiptPhoto")}</Text>

      {selectedImageUri ? (
        <TouchableOpacity style={styles.imageContainer} onPress={selectImage}>
          <Image
            source={{ uri: selectedImageUri }}
            style={styles.selectedImage}
          />
          <View style={styles.changeImageOverlay}>
            <Text style={styles.changeImageText}>
              {t("upload.tapToChange")}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholderContainer}>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>📷</Text>
            <Text style={styles.placeholderLabel}>
              {t("upload.noImageSelected")}
            </Text>
          </View>
          <Button
            title={t("upload.takePhotos")}
            onPress={openCamera}
            style={styles.button}
          />
          <Button
            title={t("upload.chooseFromLibrary")}
            onPress={openImageLibrary}
            variant="outline"
            style={styles.button}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    fontWeight: "500",
    marginBottom: theme.spacing.md,
  },
  imageContainer: {
    borderRadius: theme.borderRadius.medium,
    overflow: "hidden",
    position: "relative",
  },
  selectedImage: {
    width: "100%",
    height: 200,
    borderRadius: theme.borderRadius.medium,
  },
  changeImageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
  },
  changeImageText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.small,
    fontWeight: "500",
  },
  placeholderContainer: {
    alignItems: "center",
  },
  placeholder: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 200,
    marginBottom: theme.spacing.lg,
  },
  placeholderText: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  placeholderLabel: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  button: {
    marginBottom: theme.spacing.md,
    width: "100%",
  },
});

export default ImagePicker;
