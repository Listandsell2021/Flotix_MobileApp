import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/Ionicons";
import { changeLanguage, getLanguages } from "../i18n";

interface LanguageSelectorProps {
  style?: any;
  showLabel?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  style,
  showLabel = true,
}) => {
  const { t, i18n } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const languages = getLanguages();

  const handleLanguageChange = async (languageCode: string) => {
    console.log("Language selector: Changing to", languageCode);
    await changeLanguage(languageCode);
    setModalVisible(false);
    // Force a re-render by updating state
    console.log("Language changed, current:", i18n.language);
  };

  const currentLanguage = languages.find((lang) => lang.code === i18n.language);

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, style]}
        onPress={() => setModalVisible(true)}
      >
        <Icon name="language-outline" size={20} color="#666" />
        {showLabel && (
          <Text style={styles.selectorText}>
            {currentLanguage?.nativeName || "English"}
          </Text>
        )}
        <Icon name="chevron-down-outline" size={20} color="#666" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("settings.selectLanguage")}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={languages}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.languageItem,
                    item.code === i18n.language && styles.selectedLanguage,
                  ]}
                  onPress={() => handleLanguageChange(item.code)}
                >
                  <View>
                    <Text
                      style={[
                        styles.languageName,
                        item.code === i18n.language && styles.selectedText,
                      ]}
                    >
                      {item.nativeName}
                    </Text>
                    <Text style={styles.languageSubtext}>{item.name}</Text>
                  </View>
                  {item.code === i18n.language && (
                    <Icon name="checkmark-circle" size={24} color="#3488cc" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  selector: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    gap: 8,
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  languageItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectedLanguage: {
    backgroundColor: "#f0f8ff",
  },
  languageName: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
  },
  languageSubtext: {
    fontSize: 14,
    color: "#666",
  },
  selectedText: {
    fontWeight: "600",
    color: "#3488cc",
  },
});

export default LanguageSelector;
