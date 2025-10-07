import { useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "./Icon";
import { formatCurrency } from "../utils/currency";
import { useTranslation } from "react-i18next";

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

const ReceiptItem = ({
  item,
  index,
  removeReceipt,
  toggleExpandReceipt,
  updateReceiptData,
}: {
  item: ReceiptData;
  index: number;
  removeReceipt: Function;
  toggleExpandReceipt: Function;
  updateReceiptData: Function;
}) => {
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isItemProcessing =
    item.uploadStatus === "uploading" || item.ocrStatus === "processing";
  const amount = item.editedData?.amount || 0;
  const currency = item.editedData?.currency || "EUR";
  const type = item.editedData?.type || "MISC";
  const hasError =
    item.uploadStatus === "failed" || item.ocrStatus === "failed";
  const isReady =
    item.uploadStatus === "uploaded" && item.ocrStatus === "completed";

  const handleDelete = () => {
    Alert.alert(t("upload.reomveReceipt"), t("upload.alterRemove"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.remove"),
        style: "destructive",
        onPress: () => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            removeReceipt(item.id);
            // setReceipts((prev) => prev.filter((r) => r.id !== item.id));

            // onRemove(receipt.id);
          });
        },
      },
    ]);
  };

  return (
    <Animated.View style={[styles.receiptCard, { opacity: fadeAnim }]}>
      <TouchableOpacity
        // style={styles.cardHeader}
        onPress={() => !isItemProcessing && toggleExpandReceipt(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View
              style={[styles.indexBadge, hasError && styles.indexBadgeError]}
            >
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>

            <View style={styles.imageContainer}>
              <Image
                source={{ uri: item.imageUri }}
                style={styles.receiptThumb}
              />
              {isItemProcessing && (
                <View style={styles.imageOverlay}>
                  <ActivityIndicator size="small" color="#ffffff" />
                </View>
              )}
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.typeBadge,
                    type === "FUEL" ? styles.fuelBadge : styles.miscBadge,
                  ]}
                >
                  <Icon
                    name={type === "FUEL" ? "fuel" : "receipt"}
                    size={10}
                    color={type === "FUEL" ? "#92400e" : "#581c87"}
                  />
                  <Text
                    style={[
                      styles.typeText,
                      type === "FUEL" ? styles.fuelText : styles.miscText,
                    ]}
                  >
                    {t(`multiUpload.${type.toLowerCase()}`)}
                  </Text>
                </View>

                {isReady && (
                  <View style={styles.readyBadge}>
                    <Icon name="check" size={10} color="#065f46" />
                  </View>
                )}
              </View>

              <Text style={styles.amountText}>
                {formatCurrency(amount, currency)}
              </Text>

              {item.editedData?.merchant && (
                <Text style={styles.merchantText} numberOfLines={1}>
                  {item.editedData.merchant}
                </Text>
              )}

              {/* Status Pills */}
              {/* <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusPill,
                    item.uploadStatus === "uploaded"
                      ? styles.statusSuccess
                      : item.uploadStatus === "failed"
                      ? styles.statusError
                      : item.uploadStatus === "uploading"
                      ? styles.statusProcessing
                      : styles.statusPending,
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {item.uploadStatus === "uploaded"
                      ? "✓ " + t("common.uploaded")
                      : item.uploadStatus === "uploading"
                      ? t("common.uploading")
                      : item.uploadStatus === "failed"
                      ? "✗ " + t("common.failed")
                      : t("common.pending")}
                  </Text>
                </View>

                {item.ocrStatus !== "pending" && (
                  <View
                    style={[
                      styles.statusPill,
                      item.ocrStatus === "completed"
                        ? styles.statusSuccess
                        : item.ocrStatus === "failed"
                        ? styles.statusError
                        : item.ocrStatus === "processing"
                        ? styles.statusProcessing
                        : styles.statusPending,
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {item.ocrStatus === "completed"
                        ? "✓ OCR"
                        : item.ocrStatus === "processing"
                        ? "OCR..."
                        : item.ocrStatus === "failed"
                        ? "✗ OCR"
                        : "OCR"}
                    </Text>
                  </View>
                )}
              </View> */}
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={(e) => {
                e.stopPropagation();
                toggleExpandReceipt(item.id);
              }}
              disabled={isItemProcessing}
            >
              <Icon
                name="edit"
                size={16}
                color={isItemProcessing ? "#cbd5e1" : "#3b82f6"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
              // onPress={(e) => {
              //   e.stopPropagation();
              //   removeReceipt(item.id);
              // }}
              disabled={isItemProcessing}
            >
              <Icon
                name="delete"
                size={16}
                color={isItemProcessing ? "#cbd5e1" : "#ef4444"}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View
          style={{
            // justifyContent: "center",
            // alignItems: "center",
            paddingBottom: 16,
            paddingHorizontal: 16,
          }}
        >
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusPill,
                item.uploadStatus === "uploaded"
                  ? styles.statusSuccess
                  : item.uploadStatus === "failed"
                  ? styles.statusError
                  : item.uploadStatus === "uploading"
                  ? styles.statusProcessing
                  : styles.statusPending,
              ]}
            >
              <Text style={styles.statusPillText}>
                {item.uploadStatus === "uploaded"
                  ? "✓ " + t("common.uploaded")
                  : item.uploadStatus === "uploading"
                  ? t("common.uploading")
                  : item.uploadStatus === "failed"
                  ? "✗ " + t("common.failed")
                  : t("common.pending")}
              </Text>
            </View>

            {item.ocrStatus !== "pending" && (
              <View
                style={[
                  styles.statusPill,
                  item.ocrStatus === "completed"
                    ? styles.statusSuccess
                    : item.ocrStatus === "failed"
                    ? styles.statusError
                    : item.ocrStatus === "processing"
                    ? styles.statusProcessing
                    : styles.statusPending,
                ]}
              >
                <Text style={styles.statusPillText}>
                  {item.ocrStatus === "completed"
                    ? "✓ OCR"
                    : item.ocrStatus === "processing"
                    ? "OCR..."
                    : item.ocrStatus === "failed"
                    ? "✗ OCR"
                    : "OCR"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Expandable Edit Section */}
      {item.isExpanded && !isItemProcessing && (
        <Animated.View
          style={[
            styles.expandedSection,
            {
              maxHeight: item.animatedHeight?.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 500],
              }),
            },
          ]}
        >
          <View style={styles.editForm}>
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>{t("expense.type")}</Text>
                <View style={styles.segmentControl}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      item.editedData?.type === "FUEL" && styles.segmentActive,
                    ]}
                    onPress={() => updateReceiptData(item.id, "type", "FUEL")}
                  >
                    <Icon
                      name="fuel"
                      size={14}
                      color={
                        item.editedData?.type === "FUEL" ? "#ffffff" : "#64748b"
                      }
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        item.editedData?.type === "FUEL" &&
                          styles.segmentTextActive,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {t("expense.fuel")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      item.editedData?.type === "MISC" && styles.segmentActive,
                    ]}
                    onPress={() => updateReceiptData(item.id, "type", "MISC")}
                  >
                    <Icon
                      name="receipt"
                      size={14}
                      color={
                        item.editedData?.type === "MISC" ? "#ffffff" : "#64748b"
                      }
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        item.editedData?.type === "MISC" &&
                          styles.segmentTextActive,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {t("expense.misc")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>{t("expense.amount")} *</Text>
                <TextInput
                  style={styles.textInput}
                  value={item.editedData?.amount?.toString() || ""}
                  onChangeText={(text) => {
                    const parsedAmount = parseFloat(text) || 0;
                    updateReceiptData(item.id, "amount", parsedAmount);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={t("multiUpload.placeholders.amount")}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              {/* <View style={[styles.formField, styles.flexPoint4]}>
                <Text style={styles.fieldLabel}>{t("expense.currency")}</Text>
                <TextInput
                  style={styles.textInput}
                  value={item.editedData?.currency || "EUR"}
                  onChangeText={(text) =>
                    updateReceiptData(item.id, "currency", text)
                  }
                  placeholder="EUR"
                  placeholderTextColor="#94a3b8"
                />
              </View> */}

              <View style={[styles.formField]}>
                <Text style={styles.fieldLabel}>{t("upload.date")}</Text>
                <TextInput
                  style={styles.textInput}
                  value={
                    item.editedData?.date ||
                    new Date().toISOString().split("T")[0]
                  }
                  onChangeText={(text) =>
                    updateReceiptData(item.id, "date", text)
                  }
                  placeholder={t("multiUpload.placeholders.date")}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>{t("upload.merchant")}</Text>
                <TextInput
                  style={styles.textInput}
                  value={item.editedData?.merchant || ""}
                  onChangeText={(text) =>
                    updateReceiptData(item.id, "merchant", text)
                  }
                  placeholder="Store name"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={[styles.formRow, { marginBottom: 0 }]}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>{`${t(
                  "expense.notes"
                )} (Optional)`}</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={item.editedData?.notes || ""}
                  onChangeText={(text) =>
                    updateReceiptData(item.id, "notes", text)
                  }
                  // placeholder="Additional notes (optional)"
                  placeholder={t("expense.addNotes")}
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
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
    color: "#3b82f6",
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  fuelBadge: {
    backgroundColor: "#fef3c7",
  },
  miscBadge: {
    backgroundColor: "#f3e8ff",
  },
  typeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
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
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  merchantText: {
    fontSize: 13,
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
    paddingVertical: 6,
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
    fontSize: 14,
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
    // height: 300,
  },
  editForm: {
    padding: 16,
    paddingTop: 0,
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
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  segmentActive: {
    backgroundColor: "#3b82f6",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
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
  flexPoint4: {
    flex: 0.4,
  },
  flexPoint6: {
    flex: 0.6,
  },
});

export default ReceiptItem;
