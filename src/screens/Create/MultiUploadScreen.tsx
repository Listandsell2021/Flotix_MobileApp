import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  ImageLibraryOptions,
  CameraOptions,
  Asset,
} from "react-native-image-picker";
import Icon from "../../components/Icon";
import Toast from "../../components/Toast";
import { expensesApi, BatchExpenseItem } from "../../api/expenses";
import { vehiclesApi } from "../../api/vehicles";
import { ocrService } from "../../services/ocrService";
import { formatCurrency } from "../../utils/currency";
import { formatDate, formatDateISO } from "../../utils/date";
import { useAuth } from "../../state/authSlice";
import RNFS from "react-native-fs";
import ReceiptItem from "../../components/ReceiptItem";

interface ReceiptData {
  id: string;
  imageUri: string;
  imageUrl?: string;
  uploadStatus: "pending" | "uploading" | "uploaded" | "failed";
  ocrStatus: "pending" | "processing" | "completed" | "failed";
  isExpanded?: boolean;
  animatedHeight?: Animated.Value;
  ocrData?: {
    amount?: number;
    currency?: string;
    date?: string;
    merchant?: string;
    category?: string;
    type?: "FUEL" | "MISC";
  };
  editedData?: {
    amount?: number;
    currency?: string;
    date?: string;
    merchant?: string;
    category?: string;
    type?: "FUEL" | "MISC";
    notes?: string;
    odometerReading?: number;
    kilometers?: number;
  };
}

const MultiUploadScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { state: authState } = useAuth();
  const { t } = useTranslation();
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [_isProcessing, _setIsProcessing] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [commonOdometer, setCommonOdometer] = useState<string>("");
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);

  // State for current vehicle data (will be refreshed on screen load)
  const [currentVehicle, setCurrentVehicle] = useState(
    authState.driverData?.assignedVehicle || null
  );
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [odometerError, setOdometerError] = useState<string>("");

  // Get the vehicle's current odometer from driver data or refreshed data
  const vehicleOdometer = currentVehicle?.currentOdometer || 0;
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    visible: false,
    message: "",
    type: "info",
  });

  // Refresh vehicle data when screen loads to get current odometer
  useEffect(() => {
    // Always refresh vehicle data to get the latest odometer reading from database
    if (authState.user?.assignedVehicleId) {
      console.log(
        "🔄 Refreshing vehicle data to get latest odometer reading from database"
      );
      refreshVehicleData();
    } else {
      console.log(
        "⚠️ No assigned vehicle found, using cached data if available"
      );
    }
  }, []);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ visible: false, message: "", type: "info" });
  };

  // Function to refresh vehicle data to get current odometer reading
  const refreshVehicleData = async () => {
    if (!authState.user?.assignedVehicleId) {
      console.log("📍 No assigned vehicle to refresh");
      return;
    }

    setVehicleLoading(true);
    try {
      console.log("🔄 Refreshing vehicle data for current odometer...");
      const response = await vehiclesApi.getMyVehicle();
      if (response.success && response.data) {
        const oldOdometer = currentVehicle?.currentOdometer || 0;
        const newOdometer = response.data.currentOdometer;

        setCurrentVehicle(response.data);
        console.log("✅ Vehicle data refreshed:", {
          make: response.data.make,
          model: response.data.model,
          licensePlate: response.data.licensePlate,
          previousOdometer: oldOdometer,
          currentOdometer: newOdometer,
          odometerChanged: oldOdometer !== newOdometer,
        });

        if (oldOdometer !== newOdometer) {
          console.log(
            `📊 Odometer updated: ${oldOdometer} km → ${newOdometer} km`
          );
        }
      }
    } catch (error) {
      console.error("❌ Failed to refresh vehicle data:", error);
      // Fall back to driver data from auth state if refresh fails
      if (authState.driverData?.assignedVehicle) {
        setCurrentVehicle(authState.driverData.assignedVehicle);
      }
    } finally {
      setVehicleLoading(false);
    }
  };

  // Validate odometer reading
  const validateOdometer = (value: string) => {
    if (!value || value.trim() === "") {
      setOdometerError(t("multiUpload.odometerRequired"));
      return false;
    }

    const reading = parseFloat(value);
    if (isNaN(reading) || reading < 0) {
      setOdometerError(t("multiUpload.odometerInvalid"));
      return false;
    }

    if (currentVehicle && reading < vehicleOdometer) {
      setOdometerError(
        t("multiUpload.odometerTooLow", { current: vehicleOdometer })
      );
      return false;
    }

    setOdometerError("");
    return true;
  };

  const processReceipt = useCallback(
    async (receiptId: string, imageUri: string, base64: string) => {
      try {
        // Upload image first
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === receiptId ? { ...r, uploadStatus: "uploading" } : r
          )
        );

        const uploadResult = await expensesApi.uploadImage(imageUri);

        setReceipts((prev) =>
          prev.map((r) =>
            r.id === receiptId
              ? {
                  ...r,
                  uploadStatus: "uploaded",
                  imageUrl: uploadResult.imageUrl,
                }
              : r
          )
        );

        // Process OCR
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === receiptId ? { ...r, ocrStatus: "processing" } : r
          )
        );

        const ocrResult = await ocrService.analyzeReceipt(base64);

        if (ocrResult.success && ocrResult.data) {
          setReceipts((prev) =>
            prev.map((r) =>
              r.id === receiptId
                ? {
                    ...r,
                    ocrStatus: "completed",
                    ocrData: ocrResult.data,
                    editedData: { ...ocrResult.data },
                  }
                : r
            )
          );
        } else {
          setReceipts((prev) =>
            prev.map((r) =>
              r.id === receiptId
                ? {
                    ...r,
                    ocrStatus: "failed",
                    editedData: {
                      type: "MISC",
                      currency: "EUR",
                      date: formatDate(new Date()), // dd.mm.yyyy format
                    },
                  }
                : r
            )
          );
          showToast(`OCR failed for one receipt`, "error");
        }
      } catch (error: any) {
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === receiptId
              ? {
                  ...r,
                  uploadStatus: "failed",
                  ocrStatus: "failed",
                  editedData: {
                    type: "MISC",
                    currency: "EUR",
                    date: formatDate(new Date()), // dd.mm.yyyy format
                  },
                }
              : r
          )
        );
        showToast(`Failed to process receipt`, "error");
      }
    },
    [showToast]
  );

  const pickMultipleImages = useCallback(
    async (source: "camera" | "gallery") => {
      setShowImageSourceModal(false); // Close the modal

      const options: ImageLibraryOptions & CameraOptions = {
        mediaType: "photo",
        quality: 0.8,
        includeBase64: true,
        selectionLimit: source === "gallery" ? 10 : 1,
      };

      const picker = source === "camera" ? launchCamera : launchImageLibrary;

      picker(options, async (response: ImagePickerResponse) => {
        console.log(
          `📸 ${source === "camera" ? "Camera" : "Gallery"} response received`
        );
        console.log(`   Assets count: ${response.assets?.length || 0}`);

        if (response.didCancel || response.errorMessage) {
          if (response.errorMessage) {
            showToast(response.errorMessage, "error");
          }
          return;
        }

        if (response.assets && response.assets.length > 0) {
          console.log(
            `✅ Processing ${response.assets.length} image(s) from ${source}`
          );
          const newReceipts: ReceiptData[] = response.assets.map(
            (asset: Asset) => ({
              id: `receipt_${Date.now()}_${Math.random()}`,
              imageUri: asset.uri || "",
              uploadStatus: "pending",
              ocrStatus: "pending",
              animatedHeight: new Animated.Value(0),
            })
          );

          setReceipts((prev) => [...prev, ...newReceipts]);

          // Process each image
          for (const [index, asset] of response.assets.entries()) {
            if (asset.uri) {
              // For camera images, base64 might not be included even with includeBase64: true
              // If base64 is missing, convert the image
              let base64Data = asset.base64;

              if (!base64Data) {
                console.log(
                  "⚠️ Base64 not provided for camera image, converting..."
                );
                try {
                  const cleanUri = asset.uri.replace("file://", "");
                  base64Data = await RNFS.readFile(cleanUri, "base64");
                  console.log(
                    "✅ Successfully converted camera image to base64"
                  );
                } catch (error) {
                  console.error(
                    "❌ Failed to convert camera image to base64:",
                    error
                  );
                  showToast(t("multiUpload.messages.failedToProcess"), "error");
                  continue;
                }
              }

              await processReceipt(
                newReceipts[index].id,
                asset.uri,
                base64Data
              );
            }
          }
        }
      });
    },
    [processReceipt]
  );

  const updateReceiptData = (receiptId: string, field: string, value: any) => {
    setReceipts((prev) =>
      prev.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              editedData: {
                ...r.editedData,
                [field]: value,
              },
            }
          : r
      )
    );
  };

  const toggleExpandReceipt = (receiptId: string) => {
    setReceipts((prev) =>
      prev.map((r) => {
        if (r.id === receiptId) {
          const isExpanding = !r.isExpanded;
          if (r.animatedHeight) {
            Animated.timing(r.animatedHeight, {
              toValue: isExpanding ? 1 : 0,
              duration: 300,
              useNativeDriver: false,
            }).start();
          }
          return { ...r, isExpanded: isExpanding };
        }
        return r;
      })
    );
  };

  const removeReceipt = (receiptId: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== receiptId));

    // Show success message
    showToast(t("multiUpload.receiptRemovedSuccess"), "success");
    // Alert.alert(
    //   t("multiUpload.removeReceipt"),
    //   t("multiUpload.removeReceiptConfirm"),
    //   [
    //     { text: t("multiUpload.cancel"), style: "cancel" },
    //     {
    //       text: t("multiUpload.remove"),
    //       style: "destructive",
    //       onPress: () => {
    //         // Remove receipt immediately without animation to avoid affecting other items
    //         setReceipts((prev) => prev.filter((r) => r.id !== receiptId));

    //         // Show success message
    //         showToast(t("multiUpload.receiptRemovedSuccess"), "success");
    //       },
    //     },
    //   ]
    // );
  };

  const handleBatchUpload = async () => {
    // Validate odometer reading first
    if (!validateOdometer(commonOdometer)) {
      showToast(t("multiUpload.enterValidOdometer"), "error");
      return;
    }

    const validReceipts = receipts.filter(
      (r) =>
        r.uploadStatus === "uploaded" &&
        r.editedData?.amount &&
        r.editedData?.amount > 0
    );

    if (validReceipts.length === 0) {
      showToast(t("multiUpload.noValidReceipts"), "error");
      return;
    }

    Alert.alert(
      t("multiUpload.uploadAllExpenses"),
      t("multiUpload.uploadAllConfirm"),
      [
        { text: t("multiUpload.cancel"), style: "cancel" },
        {
          text: t("multiUpload.uploadAll"),
          onPress: async () => {
            setIsBatchUploading(true);

            try {
              const batchExpenses: BatchExpenseItem[] = validReceipts.map(
                (receipt) => {
                  const mapCategory = (
                    category?: string
                  ): "TOLL" | "PARKING" | "REPAIR" | "OTHER" | undefined => {
                    if (!category) return "OTHER";
                    const cat = category.toUpperCase();
                    if (
                      cat === "TOLL" ||
                      cat === "PARKING" ||
                      cat === "REPAIR"
                    ) {
                      return cat as "TOLL" | "PARKING" | "REPAIR";
                    }
                    return "OTHER";
                  };

                  // Convert dd.mm.yyyy to ISO format for API and validate date
                  const formatDateForAPI = (dateStr?: string) => {
                    if (!dateStr) {
                      return formatDateISO(new Date());
                    }

                    // If it's in dd.mm.yyyy format, convert to ISO
                    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
                      const [day, month, year] = dateStr.split(".");
                      const inputDate = new Date(
                        parseInt(year),
                        parseInt(month) - 1,
                        parseInt(day)
                      );
                      const today = new Date();
                      today.setHours(23, 59, 59, 999); // End of today

                      if (inputDate > today) {
                        return formatDateISO(new Date());
                      }
                      return formatDateISO(inputDate);
                    }

                    // If it's already in YYYY-MM-DD format, return as is
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                      const inputDate = new Date(dateStr);
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);

                      if (inputDate > today) {
                        return formatDateISO(new Date());
                      }
                      return dateStr;
                    }

                    // If it's in ISO format, extract just the date part
                    if (dateStr.includes("T")) {
                      const datePart = dateStr.split("T")[0];
                      const inputDate = new Date(datePart);
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);

                      if (inputDate > today) {
                        return formatDateISO(new Date());
                      }
                      return datePart;
                    }

                    return formatDateISO(new Date());
                  };

                  return {
                    type: receipt.editedData?.type || "MISC",
                    amountFinal: receipt.editedData?.amount || 0,
                    currency: "EUR",
                    date: formatDateForAPI(receipt.editedData?.date),
                    receiptUrl: receipt.imageUrl || "",
                    merchant: receipt.editedData?.merchant,
                    category: mapCategory(receipt.editedData?.category),
                    notes: receipt.editedData?.notes,
                    odometerReading: commonOdometer
                      ? parseInt(commonOdometer, 10)
                      : undefined,
                    kilometers: commonOdometer
                      ? parseInt(commonOdometer, 10)
                      : undefined,
                  };
                }
              );

              const response = await expensesApi.batchCreate(batchExpenses);
              setIsBatchUploading(false);

              if (response.success && response.data) {
                const { totalSuccessful, totalFailed, failed } = response.data;

                // Handle partial success/failure
                if (totalSuccessful > 0) {
                  // Log failed items for debugging
                  if (failed && failed.length > 0) {
                    console.error("Failed expenses:", failed);

                    // Show specific error messages
                    const errorMessages = failed
                      .map((f: any) => `Receipt #${f.index + 1}: ${f.error}`)
                      .join("\n");

                    // Show appropriate message based on success/failure ratio
                    if (totalFailed > 0) {
                      Alert.alert(
                        t("multiUpload.partialUploadSuccess"),
                        t("multiUpload.uploadSummary", {
                          successCount: totalSuccessful,
                          failCount: totalFailed,
                          errorMessages: errorMessages,
                        }),
                        [
                          {
                            text: t("multiUpload.viewHistory"),
                            onPress: () => navigation.navigate("History"),
                          },
                          {
                            text: t("multiUpload.stayHere"),
                            style: "cancel",
                          },
                        ]
                      );
                    } else {
                      showToast(
                        t("multiUpload.uploadSuccess", {
                          count: totalSuccessful,
                        }),
                        "success"
                      );
                      setTimeout(() => {
                        navigation.reset({
                          index: 0,
                          routes: [
                            {
                              name: "History",
                              params: { screen: "ExpensesList" },
                            },
                          ],
                        });
                      }, 1500);
                    }
                  } else {
                    // All successful
                    showToast(
                      t("multiUpload.uploadSuccess", {
                        count: totalSuccessful,
                      }),
                      "success"
                    );
                    setTimeout(() => {
                      navigation.reset({
                        index: 0,
                        routes: [
                          {
                            name: "History",
                            params: { screen: "ExpensesList" },
                          },
                        ],
                      });
                    }, 1500);
                  }
                } else {
                  // All failed
                  const errorMessages =
                    failed
                      ?.map((f: any) => `Receipt #${f.index + 1}: ${f.error}`)
                      .join("\n") || "Unknown error";

                  Alert.alert(
                    t("multiUpload.uploadFailed"),
                    t("multiUpload.allFailedMessage", { errorMessages }),
                    [{ text: "OK" }]
                  );
                }
              } else {
                showToast(t("multiUpload.unexpectedResponse"), "error");
              }
            } catch (error: any) {
              setIsBatchUploading(false);
              showToast(
                error.message || t("multiUpload.messages.failedToUpload"),
                "error"
              );
            }
          },
        },
      ]
    );
  };

  // const renderReceiptItem = ({
  //   item,
  //   index,
  // }: {
  //   item: ReceiptData;
  //   index: number;
  // }) => {
  //   const isItemProcessing =
  //     item.uploadStatus === "uploading" || item.ocrStatus === "processing";
  //   const amount = item.editedData?.amount || 0;
  //   const currency = "EUR";
  //   const type = item.editedData?.type || "MISC";
  //   const hasError =
  //     item.uploadStatus === "failed" || item.ocrStatus === "failed";
  //   const isReady =
  //     item.uploadStatus === "uploaded" && item.ocrStatus === "completed";

  //   return (
  //     <View style={styles.receiptCard}>
  //       <TouchableOpacity
  //         style={styles.cardHeader}
  //         onPress={() => !isItemProcessing && toggleExpandReceipt(item.id)}
  //         activeOpacity={0.7}
  //       >
  //         <View style={styles.cardLeft}>
  //           <View
  //             style={[styles.indexBadge, hasError && styles.indexBadgeError]}
  //           >
  //             <Text style={styles.indexText}>{index + 1}</Text>
  //           </View>

  //           <View style={styles.imageContainer}>
  //             <Image
  //               source={{ uri: item.imageUri }}
  //               style={styles.receiptThumb}
  //             />
  //             {isItemProcessing && (
  //               <View style={styles.imageOverlay}>
  //                 <ActivityIndicator size="small" color="#ffffff" />
  //               </View>
  //             )}
  //           </View>

  //           <View style={styles.cardInfo}>
  //             <View style={styles.cardTopRow}>
  //               <View
  //                 style={[
  //                   styles.typeBadge,
  //                   type === "FUEL" ? styles.fuelBadge : styles.miscBadge,
  //                 ]}
  //               >
  //                 <Icon
  //                   name={type === "FUEL" ? "fuel" : "receipt"}
  //                   size={10}
  //                   color={type === "FUEL" ? "#92400e" : "#581c87"}
  //                 />
  //                 <Text
  //                   style={[
  //                     styles.typeText,
  //                     type === "FUEL" ? styles.fuelText : styles.miscText,
  //                   ]}
  //                   numberOfLines={1}
  //                   ellipsizeMode="tail"
  //                 >
  //                   {t(`multiUpload.${type.toLowerCase()}`)}
  //                 </Text>
  //               </View>

  //               {isReady && (
  //                 <View style={styles.readyBadge}>
  //                   <Icon name="check" size={10} color="#065f46" />
  //                 </View>
  //               )}
  //             </View>

  //             <Text style={styles.amountText}>
  //               {formatCurrency(amount, currency)}
  //             </Text>

  //             {item.editedData?.merchant && (
  //               <Text style={styles.merchantText} numberOfLines={1}>
  //                 {item.editedData.merchant}
  //               </Text>
  //             )}

  //             {/* Status Pills */}
  //             <View style={styles.statusRow}>
  //               <View
  //                 style={[
  //                   styles.statusPill,
  //                   item.uploadStatus === "uploaded"
  //                     ? styles.statusSuccess
  //                     : item.uploadStatus === "failed"
  //                     ? styles.statusError
  //                     : item.uploadStatus === "uploading"
  //                     ? styles.statusProcessing
  //                     : styles.statusPending,
  //                 ]}
  //               >
  //                 <Text style={styles.statusPillText}>
  //                   {item.uploadStatus === "uploaded"
  //                     ? t("multiUpload.uploaded")
  //                     : item.uploadStatus === "uploading"
  //                     ? t("multiUpload.uploading")
  //                     : item.uploadStatus === "failed"
  //                     ? t("multiUpload.failed")
  //                     : t("multiUpload.pending")}
  //                 </Text>
  //               </View>

  //               {item.ocrStatus !== "pending" && (
  //                 <View
  //                   style={[
  //                     styles.statusPill,
  //                     item.ocrStatus === "completed"
  //                       ? styles.statusSuccess
  //                       : item.ocrStatus === "failed"
  //                       ? styles.statusError
  //                       : item.ocrStatus === "processing"
  //                       ? styles.statusProcessing
  //                       : styles.statusPending,
  //                   ]}
  //                 >
  //                   <Text style={styles.statusPillText}>
  //                     {item.ocrStatus === "completed"
  //                       ? t("multiUpload.ocrCompleted")
  //                       : item.ocrStatus === "processing"
  //                       ? t("multiUpload.ocrProcessing")
  //                       : item.ocrStatus === "failed"
  //                       ? t("multiUpload.ocrFailed")
  //                       : t("multiUpload.ocrCompleted")}
  //                   </Text>
  //                 </View>
  //               )}
  //             </View>
  //           </View>
  //         </View>

  //         <View style={styles.cardActions}>
  //           <TouchableOpacity
  //             style={[styles.actionButton, styles.editButton]}
  //             onPress={(e) => {
  //               e.stopPropagation();
  //               toggleExpandReceipt(item.id);
  //             }}
  //             disabled={isItemProcessing}
  //           >
  //             <Icon
  //               name="edit"
  //               size={16}
  //               color={isItemProcessing ? "#cbd5e1" : "#3488cc"}
  //             />
  //           </TouchableOpacity>

  //           <TouchableOpacity
  //             style={[styles.actionButton, styles.deleteButton]}
  //             onPress={(e) => {
  //               e.stopPropagation();
  //               removeReceipt(item.id);
  //             }}
  //             disabled={isItemProcessing}
  //           >
  //             <Icon
  //               name="delete"
  //               size={16}
  //               color={isItemProcessing ? "#cbd5e1" : "#ef4444"}
  //             />
  //           </TouchableOpacity>
  //         </View>
  //       </TouchableOpacity>

  //       {/* Expandable Edit Section */}
  //       {item.isExpanded && !isItemProcessing && (
  //         <Animated.View
  //           style={[
  //             styles.expandedSection,
  //             {
  //               maxHeight: item.animatedHeight?.interpolate({
  //                 inputRange: [0, 1],
  //                 outputRange: [0, 800],
  //               }),
  //             },
  //           ]}
  //         >
  //           <ScrollView
  //             style={styles.editForm}
  //             contentContainerStyle={styles.editFormContent}
  //             showsVerticalScrollIndicator={false}
  //             nestedScrollEnabled={true}
  //           >
  //             <View style={styles.formRow}>
  //               <View style={styles.formField}>
  //                 <Text style={styles.fieldLabel}>{t("multiUpload.type")}</Text>
  //                 <View style={styles.segmentControl}>
  //                   <TouchableOpacity
  //                     style={[
  //                       styles.segmentButton,
  //                       item.editedData?.type === "FUEL" &&
  //                         styles.segmentActive,
  //                     ]}
  //                     onPress={() => updateReceiptData(item.id, "type", "FUEL")}
  //                   >
  //                     <Icon
  //                       name="fuel"
  //                       size={14}
  //                       color={
  //                         item.editedData?.type === "FUEL"
  //                           ? "#ffffff"
  //                           : "#64748b"
  //                       }
  //                     />
  //                     <Text
  //                       style={[
  //                         styles.segmentText,
  //                         item.editedData?.type === "FUEL" &&
  //                           styles.segmentTextActive,
  //                       ]}
  //                       numberOfLines={1}
  //                       ellipsizeMode="tail"
  //                     >
  //                       {t("expense.fuel")}
  //                     </Text>
  //                   </TouchableOpacity>

  //                   <TouchableOpacity
  //                     style={[
  //                       styles.segmentButton,
  //                       item.editedData?.type === "MISC" &&
  //                         styles.segmentActive,
  //                     ]}
  //                     onPress={() => updateReceiptData(item.id, "type", "MISC")}
  //                   >
  //                     <Icon
  //                       name="receipt"
  //                       size={14}
  //                       color={
  //                         item.editedData?.type === "MISC"
  //                           ? "#ffffff"
  //                           : "#64748b"
  //                       }
  //                     />
  //                     <Text
  //                       style={[
  //                         styles.segmentText,
  //                         item.editedData?.type === "MISC" &&
  //                           styles.segmentTextActive,
  //                       ]}
  //                       numberOfLines={1}
  //                       ellipsizeMode="tail"
  //                     >
  //                       {t("expense.misc")}
  //                     </Text>
  //                   </TouchableOpacity>
  //                 </View>
  //               </View>

  //               <View style={styles.formField}>
  //                 <Text style={styles.fieldLabel}>
  //                   {t("multiUpload.amountRequired")}
  //                 </Text>
  //                 <TextInput
  //                   style={styles.textInput}
  //                   value={item.editedData?.amount?.toString() || ""}
  //                   onChangeText={(text) => {
  //                     const parsedAmount = parseFloat(text) || 0;
  //                     updateReceiptData(item.id, "amount", parsedAmount);
  //                   }}
  //                   keyboardType="decimal-pad"
  //                   placeholder={t("multiUpload.placeholders.amount")}
  //                   placeholderTextColor="#94a3b8"
  //                 />
  //               </View>
  //             </View>

  //             <View style={styles.formField}>
  //               <Text style={styles.fieldLabel}>{t("multiUpload.date")}</Text>
  //               <TextInput
  //                 style={styles.textInput}
  //                 value={item.editedData?.date || formatDate(new Date())}
  //                 onChangeText={(text) =>
  //                   updateReceiptData(item.id, "date", text)
  //                 }
  //                 placeholder={t("multiUpload.placeholders.date")}
  //                 placeholderTextColor="#94a3b8"
  //               />
  //             </View>

  //             <View style={styles.formField}>
  //               <Text style={styles.fieldLabel}>
  //                 {t("multiUpload.merchant")}
  //               </Text>
  //               <TextInput
  //                 style={styles.textInput}
  //                 value={item.editedData?.merchant || ""}
  //                 onChangeText={(text) =>
  //                   updateReceiptData(item.id, "merchant", text)
  //                 }
  //                 placeholder={t("multiUpload.placeholders.merchant")}
  //                 placeholderTextColor="#94a3b8"
  //               />
  //             </View>

  //             <View style={styles.formField}>
  //               <Text style={styles.fieldLabel}>{t("multiUpload.notes")}</Text>
  //               <TextInput
  //                 style={[styles.textInput, styles.textArea]}
  //                 value={item.editedData?.notes || ""}
  //                 onChangeText={(text) =>
  //                   updateReceiptData(item.id, "notes", text)
  //                 }
  //                 placeholder={t("multiUpload.placeholders.notes")}
  //                 placeholderTextColor="#94a3b8"
  //                 multiline
  //                 numberOfLines={2}
  //               />
  //             </View>
  //           </ScrollView>
  //         </Animated.View>
  //       )}
  //     </View>
  //   );
  // };

  return (
    <SafeAreaView edges={["left", "right", "top"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* Modern Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={20} color="#1f2937" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t("multiUpload.title")}</Text>
            <Text style={styles.headerSubtitle}>
              {t("multiUpload.subtitle")}
            </Text>
          </View>

          <View style={styles.headerRight}>
            {receipts.length > 0 && (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>{receipts.length}</Text>
              </View>
            )}
          </View>
        </View>

        {receipts.length === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyContainer}>
            <View style={styles.emptyIllustration}>
              <View style={styles.illustrationCircle}>
                <Icon name="stack" size={48} color="#3488cc" />
              </View>
            </View>

            <Text style={styles.emptyTitle}>{t("multiUpload.emptyTitle")}</Text>
            <Text style={styles.emptyDescription}>
              {t("multiUpload.emptyDescription")}
            </Text>

            <View style={styles.uploadOptions}>
              <TouchableOpacity
                style={styles.primaryUploadButton}
                onPress={() => pickMultipleImages("gallery")}
              >
                <View style={styles.uploadButtonIcon}>
                  <Icon name="image" size={20} color="#ffffff" />
                </View>
                <View style={styles.uploadButtonContent}>
                  <Text style={styles.uploadButtonTitle}>
                    {t("multiUpload.chooseFromGallery")}
                  </Text>
                  <Text style={styles.uploadButtonSubtitle}>
                    {t("multiUpload.galleryDescription")}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryUploadButton}
                onPress={() => pickMultipleImages("camera")}
              >
                <View style={[styles.uploadButtonIcon, styles.secondaryIcon]}>
                  <Icon name="camera" size={20} color="#3488cc" />
                </View>
                <View style={styles.uploadButtonContent}>
                  <Text style={styles.secondaryButtonTitle}>
                    {t("multiUpload.takePhoto")}
                  </Text>
                  <Text style={styles.secondaryButtonSubtitle}>
                    {t("multiUpload.takePhotoDescription")}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color="#3488cc" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
            <FlatList
              data={receipts}
              renderItem={({ item, index }) => (
                <ReceiptItem
                  item={item}
                  index={index}
                  removeReceipt={removeReceipt}
                  toggleExpandReceipt={toggleExpandReceipt}
                  updateReceiptData={updateReceiptData}
                />
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 500 },
              ]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            />

            {/* Modern Bottom Action Bar */}
            <View style={styles.bottomBar}>
              {/* Odometer Input */}
              <View style={styles.odometerSection}>
                <View style={styles.odometerInputContainer}>
                  <View style={styles.odometerIconBox}>
                    <Icon name="car" size={18} color="#3488cc" />
                  </View>
                  <View style={styles.odometerFieldFull}>
                    <Text style={styles.odometerLabel}>
                      {t("multiUpload.vehicleOdometerReading")}
                    </Text>
                    <TextInput
                      style={[
                        styles.odometerInput,
                        odometerError && styles.odometerInputError,
                      ]}
                      value={commonOdometer}
                      onChangeText={(text) => {
                        setCommonOdometer(text);
                        // Clear error when user starts typing
                        if (odometerError) {
                          setOdometerError("");
                        }
                      }}
                      onBlur={() => {
                        // Validate when user finishes editing
                        if (commonOdometer) {
                          validateOdometer(commonOdometer);
                        }
                      }}
                      keyboardType="numeric"
                      placeholder={t("multiUpload.placeholders.odometer")}
                      placeholderTextColor="#94a3b8"
                    />

                    {/* Show vehicle info hint if available */}
                    {currentVehicle && (
                      <Text style={styles.vehicleHint}>
                        {t("multiUpload.currentOdometer", {
                          odometer: vehicleOdometer,
                        })}
                        {vehicleOdometer === 0 &&
                          ` ${t("multiUpload.newVehicle")}`}
                        {vehicleLoading && ` ${t("multiUpload.updating")}`}
                      </Text>
                    )}

                    {/* Show error message if validation fails */}
                    {odometerError && (
                      <Text style={styles.odometerError}>{odometerError}</Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.bottomStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {
                      receipts.filter((r) => r.uploadStatus === "uploaded")
                        .length
                    }
                  </Text>
                  <Text style={styles.statLabel}>{t("multiUpload.ready")}</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {formatCurrency(
                      receipts.reduce(
                        (sum, r) => sum + (r.editedData?.amount || 0),
                        0
                      ),
                      "EUR"
                    )}
                  </Text>
                  <Text style={styles.statLabel}>{t("multiUpload.total")}</Text>
                </View>
              </View>

              <View style={styles.bottomActions}>
                <TouchableOpacity
                  style={styles.addMoreButton}
                  onPress={() => setShowImageSourceModal(true)}
                >
                  <Icon name="plus" size={18} color="#3488cc" />
                  <Text style={styles.addMoreText}>{t("multiUpload.add")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.uploadAllButton,
                    (isBatchUploading ||
                      receipts.filter(
                        (r) =>
                          r.uploadStatus === "uploaded" && r.editedData?.amount
                      ).length === 0) &&
                      styles.uploadButtonDisabled,
                  ]}
                  onPress={handleBatchUpload}
                  disabled={
                    isBatchUploading ||
                    receipts.filter(
                      (r) =>
                        r.uploadStatus === "uploaded" && r.editedData?.amount
                    ).length === 0
                  }
                >
                  {isBatchUploading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Icon name="upload" size={18} color="#ffffff" />
                  )}
                  <Text style={styles.uploadAllText}>
                    {isBatchUploading
                      ? t("multiUpload.uploading")
                      : t("multiUpload.uploadAll")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* Image Source Selection Modal */}
      <Modal
        visible={showImageSourceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImageSourceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageSourceModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              {t("multiUpload.addReceipts")}
            </Text>
            <Text style={styles.modalSubtitle}>
              {t("multiUpload.addReceiptsSubtitle")}
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickMultipleImages("camera")}
            >
              <View style={styles.modalOptionIcon}>
                <Icon name="camera" size={24} color="#3488cc" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>
                  {t("multiUpload.takePhoto")}
                </Text>
                <Text style={styles.modalOptionDescription}>
                  {t("multiUpload.useCamera")}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickMultipleImages("gallery")}
            >
              <View style={styles.modalOptionIcon}>
                <Icon name="image" size={24} color="#8b5cf6" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>
                  {t("multiUpload.chooseFromGallery")}
                </Text>
                <Text style={styles.modalOptionDescription}>
                  {t("multiUpload.galleryDescription")}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowImageSourceModal(false)}
            >
              <Text style={styles.modalCancelText}>
                {t("multiUpload.cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  headerRight: {
    marginLeft: 16,
  },
  counterBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3488cc",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  counterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIllustration: {
    marginBottom: 32,
  },
  illustrationCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  uploadOptions: {
    width: "100%",
    gap: 12,
  },
  primaryUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3488cc",
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: "#3488cc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  secondaryUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  uploadButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryIcon: {
    backgroundColor: "#eff6ff",
  },
  uploadButtonContent: {
    flex: 1,
    marginLeft: 16,
  },
  uploadButtonTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },
  uploadButtonSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
  },
  secondaryButtonTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  secondaryButtonSubtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  listContent: {
    padding: 16,
    paddingBottom: 160,
  },
  receiptCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  indexBadgeError: {
    backgroundColor: "#fef2f2",
  },
  indexText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3488cc",
  },
  imageContainer: {
    position: "relative",
    marginRight: 12,
  },
  receiptThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
    flexShrink: 1,
    maxWidth: "60%",
  },
  fuelBadge: {
    backgroundColor: "#fef3c7",
  },
  miscBadge: {
    backgroundColor: "#f3e8ff",
  },
  typeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    flexShrink: 1,
    textAlign: "center",
  },
  fuelText: {
    color: "#92400e",
  },
  miscText: {
    color: "#581c87",
  },
  readyBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#d1fae5",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  amountText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  merchantText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  odometerText: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
    fontWeight: "500",
  },
  statusRow: {
    flexDirection: "row",
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: "#f1f5f9",
  },
  statusProcessing: {
    backgroundColor: "#fef3c7",
  },
  statusSuccess: {
    backgroundColor: "#d1fae5",
  },
  statusError: {
    backgroundColor: "#fee2e2",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#eff6ff",
  },
  deleteButton: {
    backgroundColor: "#fef2f2",
  },
  expandedSection: {
    overflow: "hidden",
  },
  editForm: {
    padding: 16,
    paddingTop: 0,
  },
  editFormContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  formField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  segmentControl: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 4,
    minWidth: 0, // Allow text to wrap if needed
  },
  segmentActive: {
    backgroundColor: "#3488cc",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
    flexShrink: 1,
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  odometerSection: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  odometerInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingRight: 12,
  },
  odometerIconBox: {
    width: 44,
    height: 44,
    backgroundColor: "#eff6ff",
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  odometerFieldFull: {
    flex: 1,
    paddingVertical: 4,
  },
  odometerLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  odometerInput: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "500",
    padding: 0,
  },
  bottomStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e2e8f0",
  },
  bottomActions: {
    flexDirection: "row",
    gap: 12,
  },
  addMoreButton: {
    flex: 0.35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  addMoreText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3488cc",
  },
  uploadAllButton: {
    flex: 0.65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3488cc",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    elevation: 3,
    shadowColor: "#3488cc",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  uploadButtonDisabled: {
    backgroundColor: "#cbd5e1",
    elevation: 0,
    shadowOpacity: 0,
  },
  uploadAllText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  modalOptionDescription: {
    fontSize: 13,
    color: "#64748b",
  },
  modalCancelButton: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },
  odometerInputError: {
    borderColor: "#ef4444",
    borderWidth: 1,
  },
  vehicleHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
    fontStyle: "italic",
  },
  odometerError: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    fontWeight: "500",
  },
});

export default MultiUploadScreen;
