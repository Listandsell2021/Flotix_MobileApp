import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../state/authSlice";
import { theme } from "../../styles/theme";
import Button from "../../components/Button";
import Toast from "../../components/Toast";
import LanguageSelector from "../../components/LanguageSelector";
import { companiesApi, Company } from "../../api/companies";

const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { state, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
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

  const loadCompanyData = async () => {
    console.log("🏢 Loading company data:", {
      hasCompanyId: !!state.user?.companyId,
      companyId: state.user?.companyId,
    });

    if (!state.user?.companyId) {
      console.log("❌ No company ID found, skipping company data load");
      return;
    }

    try {
      setCompanyLoading(true);
      console.log("🔄 Fetching company data for ID:", state.user.companyId);
      const companyData = await companiesApi.getById(state.user.companyId);
      console.log("✅ Company data received:", companyData);
      setCompany(companyData);
    } catch (error) {
      console.error("❌ Failed to load company data:", error);
      showToast("Failed to load company information", "error");
    } finally {
      setCompanyLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
  }, [state.user?.companyId]);

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), t("auth.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.logout"),
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            await logout();
            showToast(t("auth.logoutSuccess"), "success");
          } catch (error) {
            console.error("Logout error:", error);
            showToast(t("errors.logout"), "error");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert(t("profile.clearCache"), t("profile.clearCacheConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("expenses.filter.clear"),
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            // Clear all AsyncStorage except authentication tokens
            const keys = await AsyncStorage.getAllKeys();
            const keysToRemove = keys.filter(
              (key) => !["accessToken", "refreshToken", "user"].includes(key)
            );

            if (keysToRemove.length > 0) {
              await AsyncStorage.multiRemove(keysToRemove);
            }

            showToast(t("profile.clearCacheSuccess"), "success");
          } catch (error) {
            console.error("Clear cache error:", error);
            showToast("Failed to clear cache", "error");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const ProfileSection: React.FC<{
    title: string;
    children: React.ReactNode;
  }> = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const InfoRow: React.FC<{ label: string; value: string }> = ({
    label,
    value,
  }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  if (!state.user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User information not available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {state.user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName}>{state.user.name}</Text>
            <Text style={styles.userRole}>{state.user.role}</Text>
          </View>

          {/* User Information */}
          <ProfileSection title={t("profile.accountInfo")}>
            <InfoRow label={t("profile.name")} value={state.user.name} />
            <InfoRow label={t("profile.email")} value={state.user.email} />
            <InfoRow label={t("profile.role")} value={state.user.role} />
            <InfoRow label={t("profile.userId")} value={state.user._id} />
          </ProfileSection>

          {/* Company Information */}
          <ProfileSection title={t("profile.company")}>
            <InfoRow
              label={t("profile.company")}
              value={
                companyLoading
                  ? "Loading..."
                  : company?.name || state.user.companyId || "Not available"
              }
            />
            {company?.address && (
              <InfoRow label={t("profile.address")} value={company.address} />
            )}
            {company?.phone && (
              <InfoRow label={t("profile.phone")} value={company.phone} />
            )}
            {company?.email && (
              <InfoRow label={t("profile.email")} value={company.email} />
            )}
          </ProfileSection>

          {/* Settings */}
          <ProfileSection title={t("settings.title")}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{t("settings.language")}</Text>
              <LanguageSelector
                showLabel={true}
                style={styles.languageSelector}
              />
            </View>
          </ProfileSection>

          {/* App Information */}
          <ProfileSection title={t("profile.appInfo")}>
            <InfoRow label={t("profile.version")} value="1.0.0" />
            <InfoRow label={t("profile.build")} value="100" />
          </ProfileSection>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <Button
              title={t("profile.clearCache")}
              onPress={handleClearCache}
              variant="outline"
              loading={loading}
              style={styles.actionButton}
            />

            <Button
              title={t("auth.logout")}
              onPress={handleLogout}
              variant="outline"
              loading={loading}
              style={{ ...styles.actionButton, ...styles.logoutButton }}
              textStyle={styles.logoutButtonText}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>FleetFlow</Text>
            <Text style={styles.footerSubtext}>Fleet Expense Management</Text>
            <Text style={styles.footerVersion}>v1.0.0</Text>
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
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.error,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  avatarText: {
    fontSize: theme.fontSize.heading,
    fontWeight: "bold",
    color: theme.colors.surface,
  },
  userName: {
    fontSize: theme.fontSize.heading,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  userRole: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
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
  sectionContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  infoValue: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    fontWeight: "400",
    flex: 2,
    textAlign: "right",
  },
  settingRow: {
    marginBottom: theme.spacing.md,
  },
  settingLabel: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  languageSelector: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  actionsContainer: {
    marginVertical: theme.spacing.xl,
  },
  actionButton: {
    marginBottom: theme.spacing.md,
  },
  logoutButton: {
    borderColor: theme.colors.error,
  },
  logoutButtonText: {
    color: theme.colors.error,
  },
  footer: {
    alignItems: "center",
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    fontSize: theme.fontSize.title,
    fontWeight: "bold",
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  footerSubtext: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  footerVersion: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});

export default ProfileScreen;
