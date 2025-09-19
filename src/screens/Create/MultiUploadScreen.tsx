import React, { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  ImageLibraryOptions,
  CameraOptions,
  Asset,
} from 'react-native-image-picker';
import Icon from '../../components/Icon';
import Toast from '../../components/Toast';
import { expensesApi, BatchExpenseItem } from '../../api/expenses';
import { ocrService } from '../../services/ocrService';
import { formatCurrency } from '../../utils/currency';
import { useAuth } from '../../state/authSlice';
import RNFS from 'react-native-fs';


interface ReceiptData {
  id: string;
  imageUri: string;
  imageUrl?: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  isExpanded?: boolean;
  animatedHeight?: Animated.Value;
  ocrData?: {
    amount?: number;
    currency?: string;
    date?: string;
    merchant?: string;
    category?: string;
    type?: 'FUEL' | 'MISC';
  };
  editedData?: {
    amount?: number;
    currency?: string;
    date?: string;
    merchant?: string;
    category?: string;
    type?: 'FUEL' | 'MISC';
    notes?: string;
    odometerReading?: number;
    kilometers?: number;
  };
}

const MultiUploadScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { state: __authState } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [_isProcessing, _setIsProcessing] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [commonOdometer, setCommonOdometer] = useState<string>('');
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ visible: false, message: '', type: 'info' });
  };

  const processReceipt = useCallback(async (receiptId: string, imageUri: string, base64: string) => {
    try {
      // Upload image first
      setReceipts(prev => prev.map(r =>
        r.id === receiptId ? { ...r, uploadStatus: 'uploading' } : r
      ));

      const uploadResult = await expensesApi.uploadImage(imageUri);

      setReceipts(prev => prev.map(r =>
        r.id === receiptId ? {
          ...r,
          uploadStatus: 'uploaded',
          imageUrl: uploadResult.imageUrl
        } : r
      ));

      // Process OCR
      setReceipts(prev => prev.map(r =>
        r.id === receiptId ? { ...r, ocrStatus: 'processing' } : r
      ));

      const ocrResult = await ocrService.analyzeReceipt(base64);

      if (ocrResult.success && ocrResult.data) {
        setReceipts(prev => prev.map(r =>
          r.id === receiptId ? {
            ...r,
            ocrStatus: 'completed',
            ocrData: ocrResult.data,
            editedData: { ...ocrResult.data }
          } : r
        ));
      } else {
        setReceipts(prev => prev.map(r =>
          r.id === receiptId ? {
            ...r,
            ocrStatus: 'failed',
            editedData: {
              type: 'MISC',
              currency: 'EUR',
              date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
            }
          } : r
        ));
        showToast(`OCR failed for one receipt`, 'error');
      }
    } catch (error: any) {
      setReceipts(prev => prev.map(r =>
        r.id === receiptId ? {
          ...r,
          uploadStatus: 'failed',
          ocrStatus: 'failed',
          editedData: {
            type: 'MISC',
            currency: 'EUR',
            date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          }
        } : r
      ));
      showToast(`Failed to process receipt`, 'error');
    }
  }, [showToast]);

  const pickMultipleImages = useCallback(async (source: 'camera' | 'gallery') => {
    setShowImageSourceModal(false); // Close the modal

    const options: ImageLibraryOptions & CameraOptions = {
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: true,
      selectionLimit: source === 'gallery' ? 10 : 1,
    };

    const picker = source === 'camera' ? launchCamera : launchImageLibrary;

    picker(options, async (response: ImagePickerResponse) => {
      console.log(`📸 ${source === 'camera' ? 'Camera' : 'Gallery'} response received`);
      console.log(`   Assets count: ${response.assets?.length || 0}`);

      if (response.didCancel || response.errorMessage) {
        if (response.errorMessage) {
          showToast(response.errorMessage, 'error');
        }
        return;
      }

      if (response.assets && response.assets.length > 0) {
        console.log(`✅ Processing ${response.assets.length} image(s) from ${source}`);
        const newReceipts: ReceiptData[] = response.assets.map((asset: Asset) => ({
          id: `receipt_${Date.now()}_${Math.random()}`,
          imageUri: asset.uri || '',
          uploadStatus: 'pending',
          ocrStatus: 'pending',
          animatedHeight: new Animated.Value(0),
        }));

        setReceipts(prev => [...prev, ...newReceipts]);

        // Process each image
        for (const [index, asset] of response.assets.entries()) {
          if (asset.uri) {
            // For camera images, base64 might not be included even with includeBase64: true
            // If base64 is missing, convert the image
            let base64Data = asset.base64;

            if (!base64Data) {
              console.log('⚠️ Base64 not provided for camera image, converting...');
              try {
                const cleanUri = asset.uri.replace('file://', '');
                base64Data = await RNFS.readFile(cleanUri, 'base64');
                console.log('✅ Successfully converted camera image to base64');
              } catch (error) {
                console.error('❌ Failed to convert camera image to base64:', error);
                showToast('Failed to process camera image', 'error');
                continue;
              }
            }

            await processReceipt(newReceipts[index].id, asset.uri, base64Data);
          }
        }
      }
    });
  }, [processReceipt]);

  const updateReceiptData = (receiptId: string, field: string, value: any) => {
    setReceipts(prev => prev.map(r =>
      r.id === receiptId ? {
        ...r,
        editedData: {
          ...r.editedData,
          [field]: value
        }
      } : r
    ));
  };

  const toggleExpandReceipt = (receiptId: string) => {
    setReceipts(prev => prev.map(r => {
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
    }));
  };

  const removeReceipt = (receiptId: string) => {
    Alert.alert(
      'Remove Receipt',
      'Are you sure you want to remove this receipt?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              setReceipts(prev => prev.filter(r => r.id !== receiptId));
            });
          }
        }
      ]
    );
  };

  const handleBatchUpload = async () => {
    const validReceipts = receipts.filter(r =>
      r.uploadStatus === 'uploaded' &&
      r.editedData?.amount &&
      r.editedData?.amount > 0
    );

    if (validReceipts.length === 0) {
      showToast('No valid receipts to upload', 'error');
      return;
    }

    Alert.alert(
      'Upload All Expenses',
      `Upload ${validReceipts.length} expense(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload All',
          onPress: async () => {
            setIsBatchUploading(true);

            try {
              const batchExpenses: BatchExpenseItem[] = validReceipts.map(receipt => {
                const mapCategory = (category?: string): 'TOLL' | 'PARKING' | 'REPAIR' | 'OTHER' | undefined => {
                  if (!category) return 'OTHER';
                  const cat = category.toUpperCase();
                  if (cat === 'TOLL' || cat === 'PARKING' || cat === 'REPAIR') {
                    return cat as 'TOLL' | 'PARKING' | 'REPAIR';
                  }
                  return 'OTHER';
                };

                // Ensure date is in YYYY-MM-DD format and not in the future
                const formatDate = (dateStr?: string) => {
                  if (!dateStr) {
                    return new Date().toISOString().split('T')[0];
                  }

                  // If it's already in YYYY-MM-DD format, return as is
                  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    // Check if it's not in the future
                    const inputDate = new Date(dateStr);
                    const today = new Date();
                    today.setHours(23, 59, 59, 999); // End of today

                    if (inputDate > today) {
                      return new Date().toISOString().split('T')[0];
                    }
                    return dateStr;
                  }

                  // If it's in ISO format, extract just the date part
                  if (dateStr.includes('T')) {
                    const datePart = dateStr.split('T')[0];
                    const inputDate = new Date(datePart);
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);

                    if (inputDate > today) {
                      return new Date().toISOString().split('T')[0];
                    }
                    return datePart;
                  }

                  return new Date().toISOString().split('T')[0];
                };

                return {
                  type: receipt.editedData?.type || 'MISC',
                  amountFinal: receipt.editedData?.amount || 0,
                  currency: receipt.editedData?.currency || 'EUR',
                  date: formatDate(receipt.editedData?.date),
                  receiptUrl: receipt.imageUrl || '',
                  merchant: receipt.editedData?.merchant,
                  category: mapCategory(receipt.editedData?.category),
                  notes: receipt.editedData?.notes,
                  odometerReading: commonOdometer ? parseInt(commonOdometer, 10) : undefined,
                  kilometers: commonOdometer ? parseInt(commonOdometer, 10) : undefined,
                };
              });

              const response = await expensesApi.batchCreate(batchExpenses);
              setIsBatchUploading(false);

              if (response.success && response.data) {
                const { totalSuccessful, totalFailed, failed } = response.data;

                // Handle partial success/failure
                if (totalSuccessful > 0) {
                  // Log failed items for debugging
                  if (failed && failed.length > 0) {
                    console.error('Failed expenses:', failed);

                    // Show specific error messages
                    const errorMessages = failed.map((f: any) =>
                      `Receipt #${f.index + 1}: ${f.error}`
                    ).join('\n');

                    // Show appropriate message based on success/failure ratio
                    if (totalFailed > 0) {
                      Alert.alert(
                        'Partial Upload Success',
                        `${totalSuccessful} expense(s) uploaded successfully.\n\n${totalFailed} failed:\n${errorMessages}`,
                        [
                          {
                            text: 'View History',
                            onPress: () => navigation.navigate('History')
                          },
                          {
                            text: 'Stay Here',
                            style: 'cancel'
                          }
                        ]
                      );
                    } else {
                      showToast(
                        `Successfully uploaded ${totalSuccessful} expense(s)`,
                        'success'
                      );
                      setTimeout(() => {
                        navigation.navigate('History');
                      }, 1500);
                    }
                  } else {
                    // All successful
                    showToast(
                      `Successfully uploaded ${totalSuccessful} expense(s)`,
                      'success'
                    );
                    setTimeout(() => {
                      navigation.navigate('History');
                    }, 1500);
                  }
                } else {
                  // All failed
                  const errorMessages = failed?.map((f: any) =>
                    `Receipt #${f.index + 1}: ${f.error}`
                  ).join('\n') || 'Unknown error';

                  Alert.alert(
                    'Upload Failed',
                    `All expenses failed to upload:\n\n${errorMessages}`,
                    [{ text: 'OK' }]
                  );
                }
              } else {
                showToast('Unexpected response from server', 'error');
              }
            } catch (error: any) {
              setIsBatchUploading(false);
              showToast(error.message || 'Failed to upload expenses', 'error');
            }
          }
        }
      ]
    );
  };

  const renderReceiptItem = ({ item, index }: { item: ReceiptData; index: number }) => {
    const isItemProcessing = item.uploadStatus === 'uploading' || item.ocrStatus === 'processing';
    const amount = item.editedData?.amount || 0;
    const currency = item.editedData?.currency || 'EUR';
    const type = item.editedData?.type || 'MISC';
    const hasError = item.uploadStatus === 'failed' || item.ocrStatus === 'failed';
    const isReady = item.uploadStatus === 'uploaded' && item.ocrStatus === 'completed';

    return (
      <Animated.View style={[styles.receiptCard, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => !isItemProcessing && toggleExpandReceipt(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.indexBadge, hasError && styles.indexBadgeError]}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>

            <View style={styles.imageContainer}>
              <Image source={{ uri: item.imageUri }} style={styles.receiptThumb} />
              {isItemProcessing && (
                <View style={styles.imageOverlay}>
                  <ActivityIndicator size="small" color="#ffffff" />
                </View>
              )}
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.cardTopRow}>
                <View style={[
                  styles.typeBadge,
                  type === 'FUEL' ? styles.fuelBadge : styles.miscBadge
                ]}>
                  <Icon
                    name={type === 'FUEL' ? 'fuel' : 'receipt'}
                    size={10}
                    color={type === 'FUEL' ? '#92400e' : '#581c87'}
                  />
                  <Text style={[
                    styles.typeText,
                    type === 'FUEL' ? styles.fuelText : styles.miscText
                  ]}>{type}</Text>
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
              <View style={styles.statusRow}>
                <View style={[
                  styles.statusPill,
                  item.uploadStatus === 'uploaded' ? styles.statusSuccess :
                  item.uploadStatus === 'failed' ? styles.statusError :
                  item.uploadStatus === 'uploading' ? styles.statusProcessing :
                  styles.statusPending
                ]}>
                  <Text style={styles.statusPillText}>
                    {item.uploadStatus === 'uploaded' ? '✓ Uploaded' :
                     item.uploadStatus === 'uploading' ? 'Uploading...' :
                     item.uploadStatus === 'failed' ? '✗ Failed' : 'Pending'}
                  </Text>
                </View>

                {item.ocrStatus !== 'pending' && (
                  <View style={[
                    styles.statusPill,
                    item.ocrStatus === 'completed' ? styles.statusSuccess :
                    item.ocrStatus === 'failed' ? styles.statusError :
                    item.ocrStatus === 'processing' ? styles.statusProcessing :
                    styles.statusPending
                  ]}>
                    <Text style={styles.statusPillText}>
                      {item.ocrStatus === 'completed' ? '✓ OCR' :
                       item.ocrStatus === 'processing' ? 'OCR...' :
                       item.ocrStatus === 'failed' ? '✗ OCR' : 'OCR'}
                    </Text>
                  </View>
                )}
              </View>
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
              <Icon name="edit" size={16} color={isItemProcessing ? '#cbd5e1' : '#3b82f6'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={(e) => {
                e.stopPropagation();
                removeReceipt(item.id);
              }}
              disabled={isItemProcessing}
            >
              <Icon name="delete" size={16} color={isItemProcessing ? '#cbd5e1' : '#ef4444'} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Expandable Edit Section */}
        {item.isExpanded && !isItemProcessing && (
          <Animated.View style={[
            styles.expandedSection,
            {
              maxHeight: item.animatedHeight?.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 500]
              })
            }
          ]}>
            <View style={styles.editForm}>
              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.segmentControl}>
                    <TouchableOpacity
                      style={[
                        styles.segmentButton,
                        item.editedData?.type === 'FUEL' && styles.segmentActive
                      ]}
                      onPress={() => updateReceiptData(item.id, 'type', 'FUEL')}
                    >
                      <Icon
                        name="fuel"
                        size={14}
                        color={item.editedData?.type === 'FUEL' ? '#ffffff' : '#64748b'}
                      />
                      <Text style={[
                        styles.segmentText,
                        item.editedData?.type === 'FUEL' && styles.segmentTextActive
                      ]}>Fuel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.segmentButton,
                        item.editedData?.type === 'MISC' && styles.segmentActive
                      ]}
                      onPress={() => updateReceiptData(item.id, 'type', 'MISC')}
                    >
                      <Icon
                        name="receipt"
                        size={14}
                        color={item.editedData?.type === 'MISC' ? '#ffffff' : '#64748b'}
                      />
                      <Text style={[
                        styles.segmentText,
                        item.editedData?.type === 'MISC' && styles.segmentTextActive
                      ]}>Misc</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Amount *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={item.editedData?.amount?.toString() || ''}
                    onChangeText={(text) => {
                      const parsedAmount = parseFloat(text) || 0;
                      updateReceiptData(item.id, 'amount', parsedAmount);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formField, styles.flexPoint4]}>
                  <Text style={styles.fieldLabel}>Currency</Text>
                  <TextInput
                    style={styles.textInput}
                    value={item.editedData?.currency || 'EUR'}
                    onChangeText={(text) => updateReceiptData(item.id, 'currency', text)}
                    placeholder="EUR"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={[styles.formField, styles.flexPoint6]}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TextInput
                    style={styles.textInput}
                    value={item.editedData?.date || new Date().toISOString().split('T')[0]}
                    onChangeText={(text) => updateReceiptData(item.id, 'date', text)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Merchant</Text>
                <TextInput
                  style={styles.textInput}
                  value={item.editedData?.merchant || ''}
                  onChangeText={(text) => updateReceiptData(item.id, 'merchant', text)}
                  placeholder="Store name"
                  placeholderTextColor="#94a3b8"
                />
              </View>


              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={item.editedData?.notes || ''}
                  onChangeText={(text) => updateReceiptData(item.id, 'notes', text)}
                  placeholder="Additional notes (optional)"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            <Text style={styles.headerTitle}>Batch Upload</Text>
            <Text style={styles.headerSubtitle}>Process multiple receipts</Text>
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
                <Icon name="stack" size={48} color="#3b82f6" />
              </View>
            </View>

            <Text style={styles.emptyTitle}>No Receipts Yet</Text>
            <Text style={styles.emptyDescription}>
              Upload multiple receipts to process them efficiently in batch
            </Text>

            <View style={styles.uploadOptions}>
              <TouchableOpacity
                style={styles.primaryUploadButton}
                onPress={() => pickMultipleImages('gallery')}
              >
                <View style={styles.uploadButtonIcon}>
                  <Icon name="image" size={20} color="#ffffff" />
                </View>
                <View style={styles.uploadButtonContent}>
                  <Text style={styles.uploadButtonTitle}>Choose from Gallery</Text>
                  <Text style={styles.uploadButtonSubtitle}>Select up to 10 images</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryUploadButton}
                onPress={() => pickMultipleImages('camera')}
              >
                <View style={[styles.uploadButtonIcon, styles.secondaryIcon]}>
                  <Icon name="camera" size={20} color="#3b82f6" />
                </View>
                <View style={styles.uploadButtonContent}>
                  <Text style={styles.secondaryButtonTitle}>Take Photo</Text>
                  <Text style={styles.secondaryButtonSubtitle}>Capture a new receipt</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
            <FlatList
              data={receipts}
              renderItem={({ item, index }) => renderReceiptItem({ item, index })}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />

            {/* Modern Bottom Action Bar */}
            <View style={styles.bottomBar}>
              {/* Odometer Input */}
              <View style={styles.odometerSection}>
                <View style={styles.odometerInputContainer}>
                  <View style={styles.odometerIconBox}>
                    <Icon name="car" size={18} color="#3b82f6" />
                  </View>
                  <View style={styles.odometerFieldFull}>
                    <Text style={styles.odometerLabel}>Vehicle Odometer Reading</Text>
                    <TextInput
                      style={styles.odometerInput}
                      value={commonOdometer}
                      onChangeText={setCommonOdometer}
                      keyboardType="numeric"
                      placeholder="Enter current kilometers"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.bottomStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {receipts.filter(r => r.uploadStatus === 'uploaded').length}
                  </Text>
                  <Text style={styles.statLabel}>Ready</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {formatCurrency(
                      receipts.reduce((sum, r) => sum + (r.editedData?.amount || 0), 0),
                      'EUR'
                    )}
                  </Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
              </View>

              <View style={styles.bottomActions}>
                <TouchableOpacity
                  style={styles.addMoreButton}
                  onPress={() => setShowImageSourceModal(true)}
                >
                  <Icon name="plus" size={18} color="#3b82f6" />
                  <Text style={styles.addMoreText}>Add</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.uploadAllButton,
                    (isBatchUploading || receipts.filter(r => r.uploadStatus === 'uploaded' && r.editedData?.amount).length === 0) && styles.uploadButtonDisabled
                  ]}
                  onPress={handleBatchUpload}
                  disabled={isBatchUploading || receipts.filter(r => r.uploadStatus === 'uploaded' && r.editedData?.amount).length === 0}
                >
                  {isBatchUploading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Icon name="upload" size={18} color="#ffffff" />
                  )}
                  <Text style={styles.uploadAllText}>
                    {isBatchUploading ? 'Uploading...' : 'Upload All'}
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

            <Text style={styles.modalTitle}>Add Receipts</Text>
            <Text style={styles.modalSubtitle}>Choose how to add your receipts</Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickMultipleImages('camera')}
            >
              <View style={styles.modalOptionIcon}>
                <Icon name="camera" size={24} color="#3b82f6" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>Take Photo</Text>
                <Text style={styles.modalOptionDescription}>Use camera to capture receipt</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickMultipleImages('gallery')}
            >
              <View style={styles.modalOptionIcon}>
                <Icon name="image" size={24} color="#8b5cf6" />
              </View>
              <View style={styles.modalOptionContent}>
                <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.modalOptionDescription}>Select up to 10 images</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowImageSourceModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  headerRight: {
    marginLeft: 16,
  },
  counterBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIllustration: {
    marginBottom: 32,
  },
  illustrationCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  uploadOptions: {
    width: '100%',
    gap: 12,
  },
  primaryUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  secondaryUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  uploadButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryIcon: {
    backgroundColor: '#eff6ff',
  },
  uploadButtonContent: {
    flex: 1,
    marginLeft: 16,
  },
  uploadButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  uploadButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  secondaryButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  secondaryButtonSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  listContent: {
    padding: 16,
    paddingBottom: 160,
  },
  receiptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  indexBadgeError: {
    backgroundColor: '#fef2f2',
  },
  indexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  receiptThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  fuelBadge: {
    backgroundColor: '#fef3c7',
  },
  miscBadge: {
    backgroundColor: '#f3e8ff',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fuelText: {
    color: '#92400e',
  },
  miscText: {
    color: '#581c87',
  },
  readyBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  amountText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  merchantText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  odometerText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#f1f5f9',
  },
  statusProcessing: {
    backgroundColor: '#fef3c7',
  },
  statusSuccess: {
    backgroundColor: '#d1fae5',
  },
  statusError: {
    backgroundColor: '#fee2e2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#eff6ff',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  expandedSection: {
    overflow: 'hidden',
  },
  editForm: {
    padding: 16,
    paddingTop: 0,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  segmentActive: {
    backgroundColor: '#3b82f6',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  flexPoint4: {
    flex: 0.4,
  },
  flexPoint6: {
    flex: 0.6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  odometerSection: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  odometerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingRight: 12,
  },
  odometerIconBox: {
    width: 44,
    height: 44,
    backgroundColor: '#eff6ff',
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  odometerFieldFull: {
    flex: 1,
    paddingVertical: 4,
  },
  odometerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  odometerInput: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
    padding: 0,
  },
  bottomStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addMoreButton: {
    flex: 0.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  addMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3b82f6',
  },
  uploadAllButton: {
    flex: 0.65,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    elevation: 3,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  uploadButtonDisabled: {
    backgroundColor: '#cbd5e1',
    elevation: 0,
    shadowOpacity: 0,
  },
  uploadAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  modalOptionDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  modalCancelButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
});

export default MultiUploadScreen;