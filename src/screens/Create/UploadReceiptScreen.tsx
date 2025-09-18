import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { CreateStackParamList } from "../../navigation/CreateStack";
import { theme } from "../../styles/theme";
import { useExpense } from "../../state/expenseSlice";
import ImagePicker from "../../components/ImagePicker";
import Button from "../../components/Button";
import Toast from "../../components/Toast";
import Icon from "../../components/Icon";
import { ocrService, ExpenseDetails } from "../../services/ocrService";
import { formatCurrency } from "../../utils/currency";
import { formatDisplayDate } from "../../utils/date";
import RNFS from "react-native-fs";
import { useTranslation } from "react-i18next";

type UploadReceiptScreenProps = {
  navigation: StackNavigationProp<CreateStackParamList, "UploadReceipt">;
};

const UploadReceiptScreen: React.FC<UploadReceiptScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const { updateForm, resetForm, setOCRResult } = useExpense();
  const [selectedImageUri, setSelectedImageUri] = useState<string>("");
  const [processingOCR, setProcessingOCR] = useState(false);
  const [ocrResult, setOcrResult] = useState<ExpenseDetails | null>(null);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    visible: false,
    message: "",
    type: "info",
  });

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ visible: false, message: "", type: "info" });
  };

  React.useEffect(() => {
    resetForm();
  }, []);

  const handleImageSelected = async (uri: string) => {
    setSelectedImageUri(uri);
    setOcrResult(null);

    // Start OCR processing immediately after image selection
    await processOCR(uri);
  };

  const processOCR = async (imageUri: string) => {
    setProcessingOCR(true);
    showToast(t("upload.analyzingWithOCR"), "info");

    try {
      console.log("Starting OCR processing for image:", imageUri);

      // Convert image to base64
      const base64 = await convertImageToBase64(imageUri);
      console.log("Image converted to base64, length:", base64.length);

      // Process with OCR service
      const response = await ocrService.analyzeReceipt(base64);
      console.log("OCR response:", response);

      if (response.success && response.data) {
        setOcrResult(response.data);

        // Update form with OCR results
        if (response.data.amount) {
          setOCRResult(response.data.amount, response.data.amount);
        }

        // Map OCR category to backend format
        const mapCategory = (category?: string): string | undefined => {
          if (!category) return undefined;
          const cat = category.toLowerCase();
          if (cat.includes("toll")) return "TOLL";
          if (cat.includes("parking")) return "PARKING";
          if (cat.includes("repair") || cat.includes("maintenance"))
            return "REPAIR";
          return "OTHER";
        };

        // Update form with all extracted data
        // Convert date to German format (DD.MM.YYYY)
        const dateToUse = response.data.date
          ? formatDisplayDate(response.data.date)
          : formatDisplayDate(new Date().toISOString());

        updateForm({
          type: response.data.type === "FUEL" ? "Fuel" : "Misc",
          amountFinal: response.data.amount || 0,
          currency: response.data.currency || "USD",
          date: dateToUse,
          category: mapCategory(response.data.category),
          merchant: response.data.merchant,
          isOCRProcessed: true,
        });

        const amount = response.data.amount || 0;
        const currency = response.data.currency || "USD";
        showToast(
          `OCR detected: ${formatCurrency(amount, currency)}`,
          "success"
        );
      } else {
        console.log("OCR failed or no data detected:", response.error);
        showToast(
          response.error || "OCR processing completed, but no details detected",
          "info"
        );
      }
    } catch (error) {
      console.error("OCR processing error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      showToast(`OCR processing failed: ${errorMessage}`, "error");
    } finally {
      setProcessingOCR(false);
    }
  };

  const convertImageToBase64 = async (imageUri: string): Promise<string> => {
    try {
      // Clean the URI - remove 'file://' prefix if present
      const cleanUri = imageUri.replace("file://", "");

      // Use react-native-fs to read the file as base64
      const base64 = await RNFS.readFile(cleanUri, "base64");
      return base64;
    } catch (error) {
      console.error("Error converting image to base64:", error);
      throw new Error("Failed to convert image to base64");
    }
  };

  const handleContinue = () => {
    // Continue to expense form with or without receipt
    // setSelectedImageUri("");
    navigation.navigate("ExpenseForm", {
      receiptUrl: selectedImageUri || "",
      setSelectedImageUri: setSelectedImageUri,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>{t("upload.uploadReceipt")}</Text>
          <Text style={styles.description}>
            {t("upload.uploadInstruction")}
          </Text>

          <ImagePicker
            onImageSelected={handleImageSelected}
            selectedImageUri={selectedImageUri}
          />

          {/* OCR Processing Status */}
          {processingOCR && selectedImageUri && (
            <View style={styles.ocrProcessingContainer}>
              <View style={styles.ocrProcessingContent}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Icon name="search" size={20} color={theme.colors.primary} />
                <Text style={styles.ocrProcessingText}>
                  {t("upload.analyzing")}
                </Text>
              </View>
            </View>
          )}

          {/* OCR Results */}
          {ocrResult && selectedImageUri && !processingOCR && (
            <View style={styles.ocrResultsContainer}>
              <View style={styles.ocrResultsHeader}>
                <Icon name="check" size={20} color={theme.colors.success} />
                <Text style={styles.ocrResultsTitle}>
                  {t("upload.detailsExtracted")}
                </Text>
              </View>
              <View style={styles.ocrResultsContent}>
                {ocrResult.amount && (
                  <View style={styles.ocrResultRow}>
                    <Text style={styles.ocrResultLabel}>
                      {t("upload.amount")}:
                    </Text>
                    <Text style={styles.ocrResultValue}>
                      {formatCurrency(
                        ocrResult.amount,
                        ocrResult.currency || "USD"
                      )}
                    </Text>
                  </View>
                )}
                {ocrResult.merchant && (
                  <View style={styles.ocrResultRow}>
                    <Text style={styles.ocrResultLabel}>
                      {t("upload.merchant")}:
                    </Text>
                    <Text style={styles.ocrResultValue}>
                      {ocrResult.merchant}
                    </Text>
                  </View>
                )}
                {ocrResult.type && (
                  <View style={styles.ocrResultRow}>
                    <Text style={styles.ocrResultLabel}>
                      {t("upload.type")}:
                    </Text>
                    <Text style={styles.ocrResultValue}>{ocrResult.type}</Text>
                  </View>
                )}
                {ocrResult.category && (
                  <View style={styles.ocrResultRow}>
                    <Text style={styles.ocrResultLabel}>
                      {t("upload.category")}:
                    </Text>
                    <Text style={styles.ocrResultValue}>
                      {ocrResult.category}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <Button
              title={t("common.continue")}
              onPress={handleContinue}
              disabled={!selectedImageUri || processingOCR}
              style={styles.primaryButton}
            />
          </View>

          <Text style={styles.note}>💡 {t("upload.tip")}</Text>
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.heading,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  buttonContainer: {
    marginTop: theme.spacing.lg,
  },
  primaryButton: {
    marginBottom: theme.spacing.md,
  },
  secondaryButton: {
    marginBottom: theme.spacing.lg,
  },
  tertiaryButton: {
    marginBottom: theme.spacing.sm,
  },
  note: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    textAlign: "center",
    fontStyle: "italic",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
  },
  ocrProcessingContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  ocrProcessingContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  ocrProcessingText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.primary,
    fontWeight: "500",
  },
  ocrResultsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  ocrResultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  ocrResultsTitle: {
    fontSize: theme.fontSize.body,
    fontWeight: "600",
    color: theme.colors.success,
  },
  ocrResultsContent: {
    gap: theme.spacing.sm,
  },
  ocrResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  ocrResultLabel: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  ocrResultValue: {
    fontSize: theme.fontSize.small,
    color: theme.colors.text,
    fontWeight: "600",
    flex: 2,
    textAlign: "right",
  },
});

export default UploadReceiptScreen;
