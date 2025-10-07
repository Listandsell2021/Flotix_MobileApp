import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Button from "./Button";
import { theme } from "../styles/theme";
import { useTranslation } from "react-i18next";

type ExpenseForm = {
  amountFinal?: number;
  merchant?: string;
  date?: Date;
  odometerReading?: number;
};

type EditExpenseModalProps = {
  visible: boolean;
  initialValues: ExpenseForm;
  onClose: () => void;
  onSave: (updatedValues: ExpenseForm) => void;
};

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  visible,
  initialValues,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<ExpenseForm>(initialValues);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setForm((prev) => ({ ...prev, date: selectedDate }));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{t("expense.edit")}</Text>

          {/* Amount */}
          <Text style={styles.label}>{t("expense.amount")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={form.amountFinal?.toString() || ""}
            onChangeText={(text) =>
              setForm((prev) => ({
                ...prev,
                amountFinal: parseFloat(text) || 0,
              }))
            }
          />

          {/* Merchant */}
          <Text style={styles.label}>{t("expense.merchant")}</Text>
          <TextInput
            style={styles.input}
            value={form.merchant || ""}
            onChangeText={(text) =>
              setForm((prev) => ({ ...prev, merchant: text }))
            }
          />

          {/* Date */}
          <Text style={styles.label}>{t("expense.date")}</Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={styles.input}
          >
            <Text>
              {form.date
                ? form.date.toISOString().split("T")[0]
                : "Select a date"}
            </Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={form.date || new Date()}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          {/* Odometer */}
          <Text style={styles.label}>{`${t(
            "expense.currentOdometer"
          )} (km) *`}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={form.odometerReading?.toString() || ""}
            onChangeText={(text) =>
              setForm((prev) => ({
                ...prev,
                odometerReading: parseInt(text) || 0,
              }))
            }
          />

          {/* Buttons */}
          <View style={styles.modalButtons}>
            <Button
              title={t("common.cancel")}
              onPress={onClose}
              variant="outline"
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title={t("common.save")}
              onPress={() => onSave(form)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  container: {
    width: "100%",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    color: "#555",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 6,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: theme.spacing.lg,
    justifyContent: "space-between",
  },
});
