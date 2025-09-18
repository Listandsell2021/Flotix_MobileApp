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
      "Select Image",
      "Choose an option",
      [
        { text: "Camera", onPress: openCamera },
        { text: "Photo Library", onPress: openImageLibrary },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const openCamera = () => {
    const options = {
      mediaType: "photo" as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as any,
    };

    launchCamera(options, handleResponse);
  };

  const openImageLibrary = () => {
    const options = {
      mediaType: "photo" as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as any,
    };

    launchImageLibrary(options, handleResponse);
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
