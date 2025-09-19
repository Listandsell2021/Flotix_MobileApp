import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { theme } from "../../styles/theme";
import { Expense, expensesApi } from "../../api/expenses";
import { formatCurrency } from "../../utils/currency";
import { formatDisplayDate } from "../../utils/date";
import Button from "../../components/Button";
import Toast from "../../components/Toast";
import ReceiptPreview from "../../components/ReceiptPreview";
import { HistoryStackParamList } from "../../navigation/HistoryStack";
import { useTranslation } from "react-i18next";

type ExpenseDetailScreenRouteProp = RouteProp<
  HistoryStackParamList,
  "ExpenseDetail"
>;
type ExpenseDetailScreenNavigationProp = StackNavigationProp<
  HistoryStackParamList,
  "ExpenseDetail"
>;

const ExpenseDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute<ExpenseDetailScreenRouteProp>();
  const navigation = useNavigation<ExpenseDetailScreenNavigationProp>();
  const { expenseId } = route.params;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    visible: false,
    message: "",
    type: "info",
  });

  useEffect(() => {
    loadExpense();
  }, [expenseId]);

  const loadExpense = async () => {
    try {
      setLoading(true);
      // For now, we'll get the expense from the expenses list context
      // In a real app, you'd fetch it by ID from the API
      const response = await expensesApi.getList({});
      const foundExpense = response.items.find(
        (exp) => (exp._id || exp.id) === expenseId
      );
      setExpense(foundExpense || null);
    } catch (error) {
      console.error("Failed to load expense:", error);
      showToast("Failed to load expense details", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ visible: false, message: "", type: "info" });
  };

  const handleEdit = () => {
    showToast("Edit functionality not implemented yet", "info");
  };

  const handleDelete = () => {
    if (!expense) return;

    Alert.alert(t("expense.deleteConfirm"), t("expense.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          showToast("Delete functionality not implemented yet", "info");
        },
      },
    ]);
  };

  const DetailRow: React.FC<{ label: string; value: string; style?: any }> = ({
    label,
    value,
    style,
  }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, style]}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>{t("expense.loadingDetails")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Expense not found</Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            variant="outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  const isManual = !expense.ocr || !expense.amountExtracted;
  const canEdit = true; // In real app, check time window
  const canDelete = true; // In real app, check time window

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.expenseType}>
                {t(`expense.${expense.type.toLowerCase()}`)}
              </Text>
              <Text style={styles.expenseDate}>
                {formatDisplayDate(expense.date)}
              </Text>
            </View>
            <View style={styles.headerAmount}>
              <Text style={styles.amountText}>
                {formatCurrency(expense.amountFinal, expense.currency)}
              </Text>
              {isManual && (
                <View style={styles.manualBadge}>
                  <Text style={styles.manualBadgeText}>
                    {t("expense.manualEntry")}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Receipt Preview */}
          {expense.receiptUrl && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("expense.receipt")}</Text>
              <ReceiptPreview
                uri={expense.receiptUrl}
                style={styles.receiptPreview}
                showFullSize
              />
            </View>
          )}

          {/* Expense Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("expense.details")}</Text>
            <View style={styles.detailsContainer}>
              <DetailRow label={t("expense.type")} value={expense.type} />
              <DetailRow
                label={t("expense.amount")}
                value={formatCurrency(expense.amountFinal, expense.currency)}
                style={styles.amountValue}
              />
              <DetailRow
                label={t("expense.currency")}
                value={expense.currency}
              />
              <DetailRow
                label={t("expense.date")}
                value={formatDisplayDate(expense.date)}
              />

              {expense.category && (
                <DetailRow
                  label={t("expense.category")}
                  value={expense.category}
                />
              )}

              {expense.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.detailLabel}>{t("expense.notes")}</Text>
                  <Text style={styles.notesText}>{expense.notes}</Text>
                </View>
              )}

              <DetailRow
                label={t("expense.created")}
                value={formatDisplayDate(expense.createdAt)}
              />
            </View>
          </View>

          {/* OCR Information */}
          {expense.ocr && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("expense.ocrInformation")}
              </Text>
              <View style={styles.detailsContainer}>
                {expense.ocr.merchant && (
                  <DetailRow
                    label={t("expense.merchant")}
                    value={expense.ocr.merchant}
                  />
                )}

                {expense.ocr.amount && (
                  <DetailRow
                    label={t("expense.extractedAmount")}
                    value={formatCurrency(
                      expense.ocr.amount,
                      expense.ocr.currency || expense.currency
                    )}
                  />
                )}

                {expense.ocr.confidence && (
                  <DetailRow
                    label={t("expense.confidence")}
                    value={`${Math.round(expense.ocr.confidence * 100)}%`}
                  />
                )}

                {expense.ocr.date && (
                  <DetailRow
                    label={t("expense.ocrDate")}
                    value={formatDisplayDate(expense.ocr.date)}
                  />
                )}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              title={t("expense.edit")}
              onPress={handleEdit}
              disabled={!canEdit}
              style={{
                ...styles.actionButton,
                ...(!canEdit ? styles.disabledButton : {}),
              }}
            />

            <Button
              title={t("expense.delete")}
              onPress={handleDelete}
              variant="outline"
              disabled={!canDelete}
              style={{
                ...styles.actionButton,
                ...styles.deleteButton,
                ...(!canDelete ? styles.disabledButton : {}),
              }}
              textStyle={styles.deleteButtonText}
            />

            {(!canEdit || !canDelete) && (
              <Text style={styles.restrictionText}>
                💡 Expenses can only be edited or deleted within the allowed
                time window
              </Text>
            )}
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.fontSize.title,
    fontWeight: "600",
    color: theme.colors.error,
    marginBottom: theme.spacing.lg,
    textAlign: "center",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  headerInfo: {
    flex: 1,
  },
  expenseType: {
    fontSize: theme.fontSize.heading,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  expenseDate: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  headerAmount: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: theme.fontSize.heading,
    fontWeight: "bold",
    color: theme.colors.primary,
  },
  manualBadge: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.small,
    marginTop: theme.spacing.sm,
  },
  manualBadgeText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.surface,
    fontWeight: "500",
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.title,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  receiptPreview: {
    height: 200,
    borderRadius: theme.borderRadius.medium,
  },
  detailsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  detailValue: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    fontWeight: "400",
    flex: 2,
    textAlign: "right",
  },
  amountValue: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  metadataText: {
    fontSize: theme.fontSize.small,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  notesContainer: {
    paddingVertical: theme.spacing.sm,
  },
  notesText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
    lineHeight: 22,
  },
  actionsContainer: {
    marginTop: theme.spacing.xl,
  },
  actionButton: {
    marginBottom: theme.spacing.md,
  },
  deleteButton: {
    borderColor: theme.colors.error,
  },
  deleteButtonText: {
    color: theme.colors.error,
  },
  disabledButton: {
    opacity: 0.5,
  },
  restrictionText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: theme.spacing.sm,
    lineHeight: 18,
  },
});

export default ExpenseDetailScreen;
