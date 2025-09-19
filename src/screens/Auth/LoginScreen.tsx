import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../state/authSlice';
import { authApi } from '../../api/auth';
import { theme } from '../../styles/theme';
import TextInput from '../../components/TextInput';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import LanguageSelector from '../../components/LanguageSelector';

const LoginScreen: React.FC = () => {
    const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ visible: false, message: '', type: 'info' });
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
        newErrors.email = t('validation.required');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
       newErrors.email = t('validation.invalidEmail');
    }

    if (!password) {
     newErrors.password = t('validation.required');
    } else if (password.length < 6) {
        newErrors.password = t('validation.minLength', { min: 6 });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Clear any stale tokens before login attempt
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      
      const response = await authApi.login({ email: email.trim(), password });
      
      // Debug: Log the API response to see what we're getting
      console.log('🔍 Login API Response:', {
        hasDriverData: !!response.data.driverData,
        hasVehicle: !!response.data.driverData?.assignedVehicle,
        driverData: response.data.driverData,
        vehicleInfo: response.data.driverData?.assignedVehicle
      });
      
      // Handle case where driverData might not be present
      const driverData = response.data.driverData || null;
      await login(response.data.user, driverData, response.data.tokens.accessToken, response.data.tokens.refreshToken);
        showToast(t('auth.loginSuccess'), 'success');
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = t('errors.generic');
      
      if (error.response?.status === 401) {
     errorMessage = t('auth.loginError');
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Flotix</Text>
            <Text style={styles.subtitle}>Fleet Expense Management</Text>
              <LanguageSelector style={styles.languageSelector} />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>{t('auth.signIn')}</Text>
            
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Please use your credentials to sign in.
              </Text>
              <Text style={styles.infoSubtext}>
                Contact your admin if you don't have an account.
              </Text>
            </View>
            
            <TextInput
        label={t('auth.email')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
             placeholder={t('auth.email')}
              error={errors.email}
            />

            <TextInput
         label={t('auth.password')}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              secureTextEntry
              autoComplete="password"
              placeholder={t('auth.password')}
              error={errors.password}
            />

            <Button
              title={t('auth.signIn')}
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl * 2,
  },
  title: {
    fontSize: theme.fontSize.large,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
    languageSelector: {
    marginTop: theme.spacing.lg,
    alignSelf: 'center',
    minWidth: 150,
  },
  formContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  formTitle: {
    fontSize: theme.fontSize.title,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  loginButton: {
    marginTop: theme.spacing.md,
  },
  infoBox: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  infoText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  infoSubtext: {
    fontSize: theme.fontSize.tiny,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default LoginScreen;