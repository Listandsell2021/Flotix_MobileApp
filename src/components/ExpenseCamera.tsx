import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  // PermissionsAndroid,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
  MediaType,
} from 'react-native-image-picker';
import { theme } from '../styles/theme';
import Button from './Button';
import TextInput from './TextInput';
import { ocrService, ExpenseDetails } from '../services/ocrService';
import Icon from './Icon';

interface ExpenseCameraProps {
  visible: boolean;
  onClose: () => void;
  onExpenseExtracted: (expenseData: ExpenseDetails) => void;
}

const ExpenseCamera: React.FC<ExpenseCameraProps> = ({
  visible,
  onClose,
  onExpenseExtracted,
}) => {
  const [processing, setProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExpenseDetails | null>(null);
  const [odometerReading, setOdometerReading] = useState<string>('');
  const [odometerError, setOdometerError] = useState<string>('');


  /** ===== Camera ===== */
  const openCamera = async () => {
    console.log('openCamera called');

    // const ok = await requestCameraPermissions();
    // if (!ok) {
    //   Alert.alert('Permission required', 'Please enable camera/photos permission in settings.');
    //   return;
    // }

    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as any,
      includeBase64: true,
      maxWidth: 1200,
      maxHeight: 1600,
    };

    // Use callback-based approach like working ImagePicker
    launchCamera(options, handleImageResponse);
  };

  /** ===== Gallery ===== */
  const openImageLibrary = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as any,
      includeBase64: true,
      maxWidth: 1200,
      maxHeight: 1600,
      selectionLimit: 1,
      presentationStyle: 'fullScreen' as any,
    };

    // Use callback-based approach like working ImagePicker
    launchImageLibrary(options, handleImageResponse);
  };

  /** ===== Response handler ===== */
  const handleImageResponse = async (response: ImagePickerResponse) => {
    if (!response) return;
    if (response.didCancel) {
      console.log('User cancelled picker');
      return;
    }
    if (response.errorCode) {
      console.error('Picker error:', response.errorCode, response.errorMessage);
      Alert.alert('Picker error', response.errorMessage || response.errorCode);
      return;
    }

    const asset = response.assets?.[0];
    if (!asset?.uri || !asset?.base64) {
      Alert.alert('Error', 'Failed to capture image');
      return;
    }

    setCapturedImage(asset.uri);
    await processImage(asset.base64);
  };

  /** ===== OCR ===== */
  const processImage = async (base64Image: string) => {
    setProcessing(true);
    try {
      console.log('Processing image with OCR...');
      const ocrResult = await ocrService.analyzeReceipt(base64Image);

      if (ocrResult.success && ocrResult.data) {
        setExtractedData(ocrResult.data);
        console.log('Extracted expense data:', ocrResult.data);
      } else {
        Alert.alert('OCR Failed', ocrResult.error || 'Could not extract expense details');
        setExtractedData(null);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process the receipt image');
      setExtractedData(null);
    } finally {
      setProcessing(false);
    }
  };

  /** ===== UI Handlers ===== */
  const validateOdometerReading = (): boolean => {
    if (!odometerReading.trim()) {
      setOdometerError('Odometer reading is required');
      return false;
    }
    
    const reading = parseFloat(odometerReading);
    if (isNaN(reading) || reading < 0) {
      setOdometerError('Odometer reading must be a positive number');
      return false;
    }
    
    setOdometerError('');
    return true;
  };

  const handleConfirmExpense = () => {
    if (extractedData && validateOdometerReading()) {
      // Include the imageUri and odometer reading
      onExpenseExtracted({ 
        ...extractedData, 
        imageUri: capturedImage || undefined,
        odometerReading: parseFloat(odometerReading)
      });
      handleClose();
    }
  };

  const handleRetry = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setOdometerReading('');
    setOdometerError('');
  };

  const handleClose = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setOdometerReading('');
    setOdometerError('');
    setProcessing(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <Text style={styles.modalTitle}>Add Expense from Receipt</Text>

          {!capturedImage && !processing && (
            <View style={styles.instructionContainer}>
              <View style={styles.instructionRowContainer}>
                <Icon name="camera" size={20} color={theme.colors.primary} />
                <Text style={styles.instructionText}>Capture or select a photo of your receipt</Text>
              </View>
              <Text style={styles.instructionSubtext}>
                I'll extract the expense details automatically using AI
              </Text>

              <View style={styles.buttonContainer}>
                <Button
                  title="Take Photo"
                  onPress={openCamera}
                  style={styles.captureButton}
                />
                <Button
                  title="Select from Gallery"
                  onPress={openImageLibrary}
                  variant="outline"
                  style={styles.captureButton}
                />
              </View>
            </View>
          )}

          {processing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <View style={styles.processingRowContainer}>
                <Icon name="search" size={20} color={theme.colors.primary} />
                <Text style={styles.processingText}>Analyzing receipt with AI...</Text>
              </View>
              <Text style={styles.processingSubtext}>
                Extracting amount, date, and merchant details
              </Text>
            </View>
          )}

          {capturedImage && !processing && (
            <View style={styles.resultContainer}>
              <Image source={{ uri: capturedImage }} style={styles.capturedImage} />

              {extractedData ? (
                <View style={styles.extractedDataContainer}>
                  <View style={styles.extractedTitleRowContainer}>
                    <Icon name="check" size={20} color={theme.colors.success} />
                    <Text style={styles.extractedTitle}>Expense Details Extracted</Text>
                  </View>

                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Amount:</Text>
                    <Text style={styles.dataValue}>
                      {extractedData.amount
                        ? `${extractedData.currency || 'EUR'} ${extractedData.amount}`
                        : 'Not detected'}
                    </Text>
                  </View>

                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Date:</Text>
                    <Text style={styles.dataValue}>
                      {extractedData.date || 'Today'}
                    </Text>
                  </View>

                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Merchant:</Text>
                    <Text style={styles.dataValue}>
                      {extractedData.merchant || 'Unknown'}
                    </Text>
                  </View>

                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Type:</Text>
                    <Text style={styles.dataValue}>
                      {extractedData.type || 'MISC'}
                    </Text>
                  </View>

                  {/* Odometer Reading Input */}
                  <View style={styles.odometerContainer}>
                    <TextInput
                      label="Odometer Reading (km)"
                      value={odometerReading}
                      onChangeText={setOdometerReading}
                      keyboardType="numeric"
                      placeholder="45350"
                      error={odometerError}
                      style={styles.odometerInput}
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <Button
                      title="Create Expense"
                      onPress={handleConfirmExpense}
                      style={styles.confirmButton}
                    />
                    <Button
                      title="Retry"
                      onPress={handleRetry}
                      variant="outline"
                      style={styles.retryButton}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.failureContainer}>
                  <View style={styles.failureRow}>
                    <Icon name="error" size={20} color={theme.colors.error} />
                    <Text style={styles.failureText}>Could not extract details</Text>
                  </View>
                  <Button
                    title="Try Again"
                    onPress={handleRetry}
                    style={styles.retryButton}
                  />
                </View>
              )}
            </View>
          )}

          </ScrollView>
          
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    position: 'relative',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  modalTitle: {
    fontSize: theme.fontSize.title,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  instructionContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  instructionText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  instructionSubtext: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  buttonContainer: {
    gap: theme.spacing.md,
    width: '100%',
  },
  captureButton: {
    minWidth: 200,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  processingText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
    fontWeight: '600',
  },
  processingSubtext: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  resultContainer: {
    alignItems: 'center',
  },
  capturedImage: {
    width: 150,
    height: 200,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.lg,
  },
  extractedDataContainer: {
    width: '100%',
  },
  instructionRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    justifyContent: 'center',
  },
  processingRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  extractedTitleRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  failureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  extractedTitle: {
    fontSize: theme.fontSize.body,
    fontWeight: 'bold',
    color: theme.colors.success,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dataLabel: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  dataValue: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  odometerContainer: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  odometerInput: {
    fontSize: theme.fontSize.body,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  confirmButton: {
    flex: 1,
  },
  retryButton: {
    flex: 1,
  },
  failureContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  failureText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.error,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
});

export default ExpenseCamera;
