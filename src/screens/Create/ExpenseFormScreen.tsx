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
import { vehiclesApi } from "../../api/vehicles";
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
  const { receiptUrl } = route.params;

  // Helper function to get a valid date string in DD.MM.YYYY format
  const getValidDateString = (dateValue?: string): string => {
    // If we have a valid date string, use it
    if (
      dateValue &&
      dateValue !== "nan nan" &&
      dateValue.match(/^\d{2}\.\d{2}\.\d{4}$/)
    ) {
      return dateValue;
    }

    // Otherwise, return today's date in DD.MM.YYYY format
    const today = new Date();
    const day = today.getDate().toString().padStart(2, "0");
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const year = today.getFullYear();

    return `${day}.${month}.${year}`;
  };

  // State for current vehicle data (will be refreshed on screen load)
  const [currentVehicle, setCurrentVehicle] = useState(
    authState.driverData?.assignedVehicle || null
  );
  const [vehicleLoading, setVehicleLoading] = useState(false);

  // Get the vehicle's current odometer from driver data or refreshed data
  const vehicleOdometer = currentVehicle?.currentOdometer || 0;

  console.log("🚗 Vehicle data for odometer pre-fill:", {
    hasDriverData: !!authState.driverData,
    hasVehicle: !!currentVehicle,
    vehicleOdometer,
    currentOdometerValue: currentVehicle?.currentOdometer,
    vehicleId: currentVehicle?._id,
    vehicleInfo: currentVehicle
      ? {
          make: currentVehicle.make,
          model: currentVehicle.model,
          licensePlate: currentVehicle.licensePlate,
        }
      : null,
    cachedVehicleData: authState.driverData?.assignedVehicle
      ? {
          currentOdometer: authState.driverData.assignedVehicle.currentOdometer,
          make: authState.driverData.assignedVehicle.make,
          model: authState.driverData.assignedVehicle.model,
        }
      : null,
  });

  const [formData, setFormData] = useState({
    type: state.currentForm.type,
    amountFinal: state.currentForm.amountFinal.toString(),
    currency: state.currentForm.currency,
    date: getValidDateString(state.currentForm.date),
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
    } catch (error: any) {
      console.error("❌ Failed to refresh vehicle data:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        hasNetworkConnection: error.code !== "NETWORK_ERROR",
      });

      // Fall back to driver data from auth state if refresh fails
      if (authState.driverData?.assignedVehicle) {
        console.log("📦 Using cached vehicle data as fallback:", {
          cachedOdometer: authState.driverData.assignedVehicle.currentOdometer,
          make: authState.driverData.assignedVehicle.make,
          model: authState.driverData.assignedVehicle.model,
        });
        setCurrentVehicle(authState.driverData.assignedVehicle);
      } else {
        console.warn(
          "⚠️ No cached vehicle data available, odometer will show 0"
        );
        // Ensure we still have some vehicle info for the form to work
        setCurrentVehicle({
          _id: "fallback-vehicle",
          make: "Unknown",
          model: "Vehicle",
          year: 2023,
          licensePlate: "N/A",
          type: "CAR",
          status: "ACTIVE",
          currentOdometer: 0, // This will make vehicleOdometer show 0
          fuelType: "GASOLINE",
          color: "Unknown",
        });
      }
    } finally {
      setVehicleLoading(false);
    }
  };

  useEffect(() => {
    // Initialize form with data from state (from OCR or previous input)
    const newFormData = {
      type: state.currentForm.type,
      amountFinal: state.currentForm.amountFinal.toString(),
      currency: state.currentForm.currency,
      date: getValidDateString(state.currentForm.date),
      merchant: state.currentForm.merchant || "",
      category: state.currentForm.category || "",
      notes: state.currentForm.notes || "",
      // Don't auto-fill odometer reading - let user enter manually
      // Only use existing form data if available (from OCR or previous input)
      odometerReading: state.currentForm.odometerReading?.toString() || "",
    };

    console.log("📝 Pre-filling form data:", {
      originalDate: state.currentForm.date,
      validatedDate: newFormData.date,
      hasExistingOdometerReading: !!state.currentForm.odometerReading,
      existingReading: state.currentForm.odometerReading,
      vehicleOdometer,
      finalOdometerValue: newFormData.odometerReading,
    });

    setFormData(newFormData);
  }, [state.currentForm, vehicleOdometer, currentVehicle]); // Added currentVehicle dependency to update when fresh data loads

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
  }, []); // Run once when component mounts

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.amountFinal || parseFloat(formData.amountFinal) <= 0) {
      newErrors.amountFinal = t("validation.amountRequired");
    }

    if (formData.type === "Misc" && !formData.category) {
      newErrors.category = t("validation.categoryRequired");
    }

    // Date validation (if provided, must be in DD.MM.YYYY format)
    if (formData.date && !formData.date.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      newErrors.date = "Date must be in format DD.MM.YYYY";
    }

    // Odometer reading validation (REQUIRED)
    if (!formData.odometerReading || formData.odometerReading.trim() === "") {
      newErrors.odometerReading = t("validation.odometerRequired");
    } else {
      const currentReading = parseFloat(formData.odometerReading);
      if (isNaN(currentReading) || currentReading < 0) {
        newErrors.odometerReading = t("validation.odometerInvalid");
      } else if (currentVehicle && currentReading < vehicleOdometer) {
        // Validate against vehicle's current odometer - user cannot enter less than current
        newErrors.odometerReading = t("validation.odometerTooLow", {
          current: vehicleOdometer,
        });
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
      if (formData.date && formData.date !== "nan nan") {
        let dateISO = formData.date;
        if (formData.date.includes(".")) {
          const parts = formData.date.split(".");
          if (parts.length === 3) {
            const [day, month, year] = parts;
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);

            // Validate date parts
            if (
              !isNaN(dayNum) &&
              !isNaN(monthNum) &&
              !isNaN(yearNum) &&
              dayNum >= 1 &&
              dayNum <= 31 &&
              monthNum >= 1 &&
              monthNum <= 12 &&
              yearNum > 1900
            ) {
              dateISO = `${yearNum}-${monthNum
                .toString()
                .padStart(2, "0")}-${dayNum.toString().padStart(2, "0")}`;
              const dateObj = new Date(dateISO);
              if (!isNaN(dateObj.getTime())) {
                expenseData.date = dateObj.toISOString();
              }
            }
          }
        } else {
          // Try parsing as ISO string
          const dateObj = new Date(dateISO);
          if (!isNaN(dateObj.getTime())) {
            expenseData.date = dateObj.toISOString();
          }
        }
      }

      // Add currency (always required by backend)
      expenseData.currency = formData.currency
        ? formData.currency.toUpperCase()
        : "EUR";

      console.log("Creating expense with data:", expenseData);
      const newExpense = await expensesApi.create(expenseData);
      addExpense(newExpense);

      showToast(t("success.expenseCreated"), "success");
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
    if (formData.date && formData.date.includes(".")) {
      const parts = formData.date.split(".");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
        const year = parseInt(parts[2], 10);

        // Validate parsed values before creating date
        if (
          !isNaN(day) &&
          !isNaN(month) &&
          !isNaN(year) &&
          day >= 1 &&
          day <= 31 &&
          month >= 0 &&
          month <= 11 &&
          year > 1900
        ) {
          const date = new Date(year, month, day);
          // Double-check the date is valid
          if (!isNaN(date.getTime())) {
            setSelectedCalendarDate(date);
            setCurrentMonth(new Date(year, month, 1));
            setShowDatePicker(true);
            return;
          }
        }
      }
    }

    // Fallback to current date if parsing fails or date is empty
    const today = new Date();
    setSelectedCalendarDate(today);
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
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
              placeholder={t("expense.amountPlaceholder")}
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
                    formData.date && formData.date !== "nan nan"
                      ? styles.dateText
                      : styles.datePlaceholder
                  }
                >
                  {formData.date && formData.date !== "nan nan"
                    ? formData.date
                    : "DD.MM.YYYY"}
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
              <TouchableOpacity
                onPress={refreshVehicleData}
                disabled={vehicleLoading}
                style={styles.refreshButton}
              >
                <Icon
                  name="refresh"
                  size={16}
                  color={
                    vehicleLoading
                      ? theme.colors.textSecondary
                      : theme.colors.primary
                  }
                />
                <Text
                  style={[
                    styles.refreshButtonText,
                    vehicleLoading && styles.refreshButtonTextDisabled,
                  ]}
                >
                  {vehicleLoading ? "Updating..." : "Refresh"}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              label={`${t("expense.currentOdometer")} (km) *`}
              value={formData.odometerReading}
              onChangeText={(text) => updateFormField("odometerReading", text)}
              keyboardType="numeric"
              placeholder={t("expense.odometerPlaceholder")}
              error={errors.odometerReading}
            />

            {/* Show vehicle info hint if available */}
            {currentVehicle && (
              <Text style={styles.vehicleHint}>
                {currentVehicle.make} {currentVehicle.model} (
                {currentVehicle.licensePlate}) -{" "}
                {vehicleOdometer > 0
                  ? t("expense.currentOdometer:", { odometer: vehicleOdometer })
                  : t("expense.newVehicle") || "Odometer reading needed"}
                {vehicleOdometer} KM
                {vehicleLoading && ` ${t("expense.updating")}`}
              </Text>
            )}

            {currentVehicle &&
              formData.odometerReading &&
              !isNaN(parseFloat(formData.odometerReading)) &&
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
                title={t("common.cancel")}
                onPress={handleDateCancel}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title={t("common.select")}
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
  vehicleHint: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontStyle: "italic",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.small,
    backgroundColor: theme.colors.background,
  },
  refreshButtonText: {
    fontSize: theme.fontSize.tiny,
    color: theme.colors.primary,
    fontWeight: "500",
  },
  refreshButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
});

export default ExpenseFormScreen;
