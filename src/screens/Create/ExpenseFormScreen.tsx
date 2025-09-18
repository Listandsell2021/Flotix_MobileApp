import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp, useNavigation } from "@react-navigation/native";
// import DateTimePicker from '@react-native-community/datetimepicker';
import { CreateStackParamList } from "../../navigation/CreateStack";
import { theme } from "../../styles/theme";
import { useExpense } from "../../state/expenseSlice";
import { useAuth } from "../../state/authSlice";
import { expensesApi } from "../../api/expenses";
import TextInput from "../../components/TextInput";
import Button from "../../components/Button";
import Toast from "../../components/Toast";
import ReceiptPreview from "../../components/ReceiptPreview";
// import { formatCurrency } from '../../utils/currency';
import Icon from "../../components/Icon";
import { useTranslation } from "react-i18next";

type ExpenseFormScreenProps = {
  navigation: StackNavigationProp<CreateStackParamList, "ExpenseForm">;
  route: RouteProp<CreateStackParamList, "ExpenseForm">;
};

const ExpenseFormScreen: React.FC<ExpenseFormScreenProps> = ({
  // navigation,
  route,
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state, addExpense, setLoading, setError, resetForm } = useExpense();
  const { state: authState } = useAuth();
  const { receiptUrl, setSelectedImageUri } = route.params;

  // Get the vehicle's current odometer from driver data
  const vehicleOdometer =
    authState.driverData?.assignedVehicle?.currentOdometer || 0;

  const [formData, setFormData] = useState({
    type: state.currentForm.type,
    amountFinal: state.currentForm.amountFinal.toString(),
    currency: state.currentForm.currency,
    date: state.currentForm.date,
    merchant: state.currentForm.merchant || "",
    category: state.currentForm.category || "",
    notes: state.currentForm.notes || "",
    odometerReading: state.currentForm.odometerReading?.toString() || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // const [processingOCR, setProcessingOCR] = useState(false);
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

  useEffect(() => {
    // Initialize form with data from state (from OCR or previous input)
    setFormData({
      type: state.currentForm.type,
      amountFinal: state.currentForm.amountFinal.toString(),
      currency: state.currentForm.currency,
      date: state.currentForm.date,
      merchant: state.currentForm.merchant || "",
      category: state.currentForm.category || "",
      notes: state.currentForm.notes || "",
      odometerReading: state.currentForm.odometerReading?.toString() || "",
    });
  }, [state.currentForm]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.amountFinal || parseFloat(formData.amountFinal) <= 0) {
      newErrors.amountFinal = "Amount is required and must be greater than 0";
    }

    if (formData.type === "Misc" && !formData.category) {
      newErrors.category = "Category is required for miscellaneous expenses";
    }

    // Date validation (if provided, must be in DD.MM.YYYY format)
    if (formData.date && !formData.date.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      newErrors.date = "Date must be in format DD.MM.YYYY";
    }

    // Odometer reading validation (REQUIRED)
    if (!formData.odometerReading || formData.odometerReading.trim() === "") {
      newErrors.odometerReading = "Current odometer reading is required";
    } else {
      const currentReading = parseFloat(formData.odometerReading);
      if (isNaN(currentReading) || currentReading < 0) {
        newErrors.odometerReading =
          "Odometer reading must be a valid positive number";
      } else if (currentReading < vehicleOdometer) {
        newErrors.odometerReading = `Odometer reading cannot be less than vehicle's last reading (${vehicleOdometer} km)`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      // Show specific alert for missing odometer
      if (!formData.odometerReading || formData.odometerReading.trim() === "") {
        showToast(t("validation.enterOdometer"), "error");
      }
      return;
    }

    setSubmitting(true);
    setLoading(true);

    try {
      // Handle receipt URL
      let uploadedReceiptUrl = "";
      if (
        receiptUrl &&
        (receiptUrl.startsWith("file://") || receiptUrl.startsWith("/"))
      ) {
        try {
          console.log("Uploading receipt image:", receiptUrl);
          showToast(t("upload.uploading"), "info");
          const uploadResult = await expensesApi.uploadImage(receiptUrl);
          uploadedReceiptUrl = uploadResult.imageUrl;
          console.log("Receipt uploaded successfully:", uploadedReceiptUrl);
          showToast(t("upload.uploaded"), "success");
        } catch (uploadError: any) {
          console.error("Failed to upload receipt:", uploadError);
          // Check if it's a 404 error (endpoint not found)
          if (uploadError.message?.includes("404")) {
            // Backend doesn't have upload endpoint, use mock URL
            uploadedReceiptUrl = `https://fleet-receipts.s3.amazonaws.com/receipts/${Date.now()}_receipt.jpg`;
            console.log(
              "Using mock URL (upload endpoint not available):",
              uploadedReceiptUrl
            );
          } else {
            // Other error, use placeholder
            uploadedReceiptUrl =
              "https://via.placeholder.com/400x600/cccccc/666666?text=Receipt";
            showToast(t("errors.uploadFailed"), "error");
          }
        }
      } else if (receiptUrl && receiptUrl.startsWith("http")) {
        // Already an HTTP URL
        uploadedReceiptUrl = receiptUrl;
      } else {
        // No receipt provided - use a valid placeholder
        uploadedReceiptUrl =
          "https://via.placeholder.com/400x600/cccccc/666666?text=No+Receipt";
      }

      // Calculate kilometers traveled from odometer difference
      let kilometersCalculated = 0;
      if (formData.odometerReading && vehicleOdometer) {
        const currentReading = parseFloat(formData.odometerReading);
        kilometersCalculated = currentReading - vehicleOdometer;
      }

      // Prepare expense data matching the API format
      const expenseData: any = {
        type: (formData.type === "Fuel" ? "FUEL" : "MISC") as "FUEL" | "MISC",
        amountFinal: parseFloat(formData.amountFinal),
        // Use the uploaded receipt URL
        receiptUrl: uploadedReceiptUrl,
        // Always include kilometers (calculated or 0)
        kilometers: kilometersCalculated > 0 ? kilometersCalculated : 0,
        // Always include odometerReading
        odometerReading: formData.odometerReading
          ? parseFloat(formData.odometerReading)
          : vehicleOdometer || 0,
      };

      // Add merchant if provided
      if (formData.merchant?.trim()) {
        expenseData.merchant = formData.merchant.trim();
      }

      // Add optional fields
      if (formData.notes?.trim()) {
        expenseData.notes = formData.notes.trim();
      }

      if (formData.category && formData.type === "Misc") {
        expenseData.category = formData.category;
      }

      // Parse date if provided
      if (formData.date) {
        let dateISO = formData.date;
        if (formData.date.includes(".")) {
          const [day, month, year] = formData.date.split(".");
          dateISO = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
        expenseData.date = new Date(dateISO).toISOString();
      }

      // Add currency if not default
      if (formData.currency && formData.currency !== "USD") {
        expenseData.currency = formData.currency.toUpperCase();
      }

      console.log("Creating expense with data:", expenseData);
      const newExpense = await expensesApi.create(expenseData);
      addExpense(newExpense);

      showToast(t("success.expenseCreated"), "success");
      setSelectedImageUri("");
      resetForm();
      setTimeout(() => {
        navigation.reset({
          index: 0, // Set the first screen in the stack as the initial screen
          routes: [{ name: "History", params: { screen: "ExpensesList" } }],
        });
      }, 1500);
    } catch (error) {
      console.error("Submit error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create expense. Please try again.";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  const updateFormField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const openDatePicker = () => {
    // Parse current date from DD.MM.YYYY format
    const parts = formData.date.split(".");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      setSelectedCalendarDate(date);
      setCurrentMonth(new Date(year, month, 1));
    } else {
      setSelectedCalendarDate(new Date());
      setCurrentMonth(new Date());
    }
    setShowDatePicker(true);
  };

  const handleDateSelect = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    updateFormField("date", `${day}.${month}.${year}`);
    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() || 7; // Convert Sunday (0) to 7

    const days = [];
    // Add empty cells for days before month starts (Monday = 1)
    for (let i = 1; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const changeMonth = (increment: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + increment);
    setCurrentMonth(newMonth);
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const expenseTypes = [
    { label: "Fuel", value: "Fuel" },
    { label: "Miscellaneous", value: "Misc" },
  ];

  const miscCategories = [
    { label: "Toll", value: "TOLL" },
    { label: "Parking", value: "PARKING" },
    { label: "Repair", value: "REPAIR" },
    { label: "Other", value: "OTHER" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {receiptUrl && (
            <View style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <Icon name="document" size={20} color={theme.colors.primary} />
                <Text style={styles.receiptTitle}>
                  {t("expense.receiptAttached")}
                </Text>
              </View>
              <ReceiptPreview
                uri={receiptUrl}
                showFullSize
                style={styles.receiptPreview}
              />
              {state.currentForm.isOCRProcessed && (
                <View style={styles.ocrBadge}>
                  <Icon name="check" size={14} color={theme.colors.success} />
                  <Text style={styles.ocrBadgeText}>
                    {t("expense.ocrProcessed")}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Expense Type Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("expense.expenseType")}</Text>
            <View style={styles.typeContainer}>
              {expenseTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeButton,
                    formData.type === type.value && styles.typeButtonSelected,
                  ]}
                  onPress={() => updateFormField("type", type.value)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={type.value === "Fuel" ? "car" : "receipt"}
                    size={16}
                    color={
                      formData.type === type.value
                        ? theme.colors.primary
                        : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      formData.type === type.value &&
                        styles.typeButtonTextSelected,
                    ]}
                  >
                    {t(`expense.${type.value.toLowerCase()}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Details Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("expense.details")}</Text>

            {/* Merchant */}
            <TextInput
              label={`${t("expense.merchant")}/${t("expense.location")}`}
              value={formData.merchant}
              onChangeText={(text) => updateFormField("merchant", text)}
              placeholder={
                formData.type === "Fuel"
                  ? t("form.shellGasStation")
                  : t("form.storeName")
              }
              error={errors.merchant}
            />

            {/* Amount */}
            <TextInput
              label={`${t("expense.amount")} (${formData.currency})`}
              value={formData.amountFinal}
              onChangeText={(text) => updateFormField("amountFinal", text)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              error={errors.amountFinal}
            />

            {/* Date */}
            <View style={styles.dateInputContainer}>
              <Text style={styles.inputLabel}>{t("expense.date")}</Text>
              <TouchableOpacity
                style={[styles.dateInput, errors.date && styles.dateInputError]}
                onPress={openDatePicker}
                activeOpacity={0.7}
              >
                <Icon
                  name="calendar"
                  size={16}
                  color={theme.colors.textSecondary}
                />
                <Text
                  style={
                    formData.date ? styles.dateText : styles.datePlaceholder
                  }
                >
                  {formData.date || "DD.MM.YYYY"}
                </Text>
              </TouchableOpacity>
              {errors.date && (
                <Text style={styles.errorText}>{errors.date}</Text>
              )}
            </View>
          </View>

          {/* Vehicle Information */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {t("expense.vehicleInformation")}
              </Text>
              <Text style={styles.requiredText}>{t("expense.required")}</Text>
            </View>

            <TextInput
              label={`${t("expense.currentOdometer")} (km) *`}
              value={formData.odometerReading}
              onChangeText={(text) => updateFormField("odometerReading", text)}
              keyboardType="numeric"
              placeholder={
                vehicleOdometer
                  ? `${t("expense.previousReading")}: ${vehicleOdometer} km`
                  : t("expense.currentReading")
              }
              error={errors.odometerReading}
            />

            {vehicleOdometer > 0 &&
              formData.odometerReading &&
              parseFloat(formData.odometerReading) > vehicleOdometer && (
                <View style={styles.distanceCard}>
                  <Icon
                    name="location"
                    size={16}
                    color={theme.colors.success}
                  />
                  <Text style={styles.distanceText}>
                    Distance traveled:{" "}
                    {(
                      parseFloat(formData.odometerReading) - vehicleOdometer
                    ).toFixed(0)}{" "}
                    km
                  </Text>
                </View>
              )}
          </View>

          {/* Category (for Misc only) */}
          {formData.type === "Misc" && (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{t("expense.category")}</Text>
              <View style={styles.categoryContainer}>
                {miscCategories.map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    style={[
                      styles.categoryButton,
                      formData.category === category.value &&
                        styles.categoryButtonSelected,
                    ]}
                    onPress={() => updateFormField("category", category.value)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        formData.category === category.value &&
                          styles.categoryButtonTextSelected,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.category && (
                <Text style={styles.errorText}>{errors.category}</Text>
              )}
            </View>
          )}

          {/* Notes */}
          <TextInput
            label={`${t("expense.notes")} (Optional)`}
            value={formData.notes}
            onChangeText={(text) => updateFormField("notes", text)}
            multiline
            numberOfLines={3}
            placeholder={t("expense.addNotes")}
            style={styles.notesInput}
          />

          <Button
            title={t("navigation.createExpense")}
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDateCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)}>
                <Icon
                  name="arrow-left"
                  size={24}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {monthNames[currentMonth.getMonth()]}{" "}
                {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)}>
                <Icon
                  name="arrow-right"
                  size={24}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarContainer}>
              {/* Week days header */}
              <View style={styles.weekDaysRow}>
                {weekDays.map((day) => (
                  <Text key={day} style={styles.weekDayText}>
                    {day}
                  </Text>
                ))}
              </View>

              {/* Calendar days */}
              <View style={styles.calendarGrid}>
                {getDaysInMonth(currentMonth).map((day, index) => {
                  if (!day) {
                    return (
                      <View key={`empty-${index}`} style={styles.calendarDay} />
                    );
                  }

                  const isSelected =
                    day.getDate() === selectedCalendarDate.getDate() &&
                    day.getMonth() === selectedCalendarDate.getMonth() &&
                    day.getFullYear() === selectedCalendarDate.getFullYear();

                  const isToday =
                    day.getDate() === new Date().getDate() &&
                    day.getMonth() === new Date().getMonth() &&
                    day.getFullYear() === new Date().getFullYear();

                  return (
                    <TouchableOpacity
                      key={day.toISOString()}
                      style={[
                        styles.calendarDay,
                        isSelected && styles.calendarDaySelected,
                        isToday && styles.calendarDayToday,
                      ]}
                      onPress={() => setSelectedCalendarDate(day)}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          isSelected && styles.calendarDayTextSelected,
                          isToday && styles.calendarDayTextToday,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={handleDateCancel}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Select"
                onPress={() => handleDateSelect(selectedCalendarDate)}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  receiptCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  receiptTitle: {
    fontSize: theme.fontSize.body,
    fontWeight: "600",
    color: theme.colors.text,
  },
  receiptPreview: {
    height: 120,
    borderRadius: theme.borderRadius.small,
  },
  ocrBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.colors.success + "20",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.large,
    marginTop: theme.spacing.sm,
    alignSelf: "flex-start",
  },
  ocrBadgeText: {
    color: theme.colors.success,
    fontSize: theme.fontSize.tiny,
    fontWeight: "600",
  },
  receiptContainer: {
    marginBottom: theme.spacing.xl,
  },
  ocrSuccessContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.success + "15",
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.small,
    marginTop: theme.spacing.sm,
  },
  ocrSuccessText: {
    textAlign: "center",
    color: theme.colors.success,
    fontSize: theme.fontSize.small,
    fontWeight: "500",
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: theme.fontSize.small,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  requiredText: {
    fontSize: theme.fontSize.tiny || 10,
    color: theme.colors.error,
    fontWeight: "500",
  },
  fieldContainer: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  typeContainer: {
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.small,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  typeButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + "15",
  },
  typeButtonText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  typeButtonTextSelected: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.small,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  categoryButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + "15",
  },
  categoryButtonText: {
    fontSize: theme.fontSize.tiny,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  categoryButtonTextSelected: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
  errorText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  notesInput: {
    height: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  odometerContainer: {
    marginBottom: theme.spacing.sm,
  },
  distanceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.success + "15",
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.small,
    marginTop: theme.spacing.sm,
  },
  distanceText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.success,
    fontWeight: "600",
  },
  dateInputContainer: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.fontSize.small,
    color: theme.colors.text,
    fontWeight: "500",
    marginBottom: theme.spacing.xs,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.small,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  dateInputError: {
    borderColor: theme.colors.error,
  },
  dateText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    flex: 1,
  },
  datePlaceholder: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  datePickerModal: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.lg,
    width: "90%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  modalTitle: {
    fontSize: theme.fontSize.title,
    fontWeight: "bold",
    color: theme.colors.text,
    textAlign: "center",
  },
  modalContent: {
    marginBottom: theme.spacing.lg,
  },
  dateHint: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.small,
    alignItems: "center",
  },
  calendarContainer: {
    padding: theme.spacing.md,
  },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: theme.spacing.sm,
  },
  weekDayText: {
    fontSize: theme.fontSize.small,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    width: 40,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
  },
  calendarDaySelected: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.small,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.small,
  },
  calendarDayText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  calendarDayTextToday: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
});

export default ExpenseFormScreen;
