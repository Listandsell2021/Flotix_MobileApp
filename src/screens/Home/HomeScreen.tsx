import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../styles/theme';
import { useAuth } from '../../state/authSlice';
import Button from '../../components/Button';
import { expensesApi, Expense } from '../../api/expenses';
import { vehiclesApi } from '../../api/vehicles';
import { Vehicle } from '../../api/auth';
import { formatCurrency } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/date';
import Toast from '../../components/Toast';
import Icon from '../../components/Icon';


const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { logout, state } = useAuth();
  
  // Debug: Log auth state to see what vehicle data we have
  console.log('🔍 HomeScreen Auth State:', {
    hasUser: !!state.user,
    hasDriverData: !!state.driverData,
    hasVehicle: !!state.driverData?.assignedVehicle,
    vehicleData: state.driverData?.assignedVehicle
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    thisMonthItems: 0,
    fuelExpenses: 0,
    miscExpenses: 0,
    currency: 'EUR' // Default to EUR
  });
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info',
  });
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [vehicleData, setVehicleData] = useState<Vehicle | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast({ visible: false, message: '', type: 'info' });
  };

  useEffect(() => {
    loadExpenses();
    loadVehicleData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExpenses = async () => {
    try {
      setLoading(true);
      console.log('Loading expenses for driver dashboard...');
      
      const response = await expensesApi.getList({
        limit: 100, // Get more expenses for stats calculation
        page: 1,
      });
      
      const expenseItems = response.items || [];
      setExpenses(expenseItems);
      calculateStats(expenseItems);
    } catch (error: any) {
      console.error('Error loading expenses:', error);
      
      // Check if this is an auth failure
      if (error.authFailed || error.code === 'NO_REFRESH_TOKEN' || error.message?.includes('Session expired')) {
        console.log('🔐 Auth failed, logging out...');
        showToast('Session expired. Please login again.', 'error');
        // Give user time to see the message
        setTimeout(() => {
          logout();
        }, 1500);
      } else {
        showToast('Failed to load expenses', 'error');
      }
      // Set empty array on error to prevent undefined errors
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicleData = async () => {
    try {
      // Only load vehicle data if user has an assigned vehicle ID
      const assignedVehicleId = state.user?.assignedVehicleId;
      if (!assignedVehicleId) {
        console.log('No assigned vehicle ID found for user');
        return;
      }

      console.log('Loading vehicle data for ID:', assignedVehicleId);
      const response = await vehiclesApi.getVehicleDetails(assignedVehicleId);
      setVehicleData(response.data);
      console.log('Vehicle data loaded successfully:', response.data);
    } catch (error: any) {
      console.error('Error loading vehicle data:', error);
      showToast('Failed to load vehicle information', 'error');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadExpenses(), loadVehicleData()]);
    setRefreshing(false);
  };

  const calculateStats = (expenseList: Expense[]) => {
    // Ensure expenseList is an array
    if (!Array.isArray(expenseList)) {
      console.warn('calculateStats received non-array:', expenseList);
      expenseList = [];
    }

    // Get currency from first expense, fallback to EUR
    const currency = expenseList.length > 0 ? expenseList[0].currency : 'EUR';

    const total = expenseList.reduce((sum, expense) => sum + (expense.amountFinal || 0), 0);
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const thisMonthExpenses = expenseList.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    });
    
    const thisMonth = thisMonthExpenses.reduce((sum, expense) => sum + (expense.amountFinal || 0), 0);
    const thisMonthItems = thisMonthExpenses.length;
    
    // Calculate fuel and misc for THIS MONTH only
    const fuelExpenses = thisMonthExpenses
      .filter(expense => expense.type === 'Fuel' || expense.type === 'FUEL')
      .reduce((sum, expense) => sum + (expense.amountFinal || 0), 0);
    
    const miscExpenses = thisMonthExpenses
      .filter(expense => expense.type === 'Misc' || expense.type === 'MISC')
      .reduce((sum, expense) => sum + (expense.amountFinal || 0), 0);

    setStats({
      total,
      thisMonth,
      thisMonthItems,
      fuelExpenses,
      miscExpenses,
      currency
    });
  };

  const handleLogout = () => {
    logout();
  console.log(state.user)
  };

  const handleExpenseClick = (expense: Expense) => {
    console.log('📄 Opening expense details:', expense._id);
    setSelectedExpense(expense);
    setShowExpenseDetail(true);
  };

  const handleAddExpense = () => {
    // Navigate to Create Expense page (UploadReceipt screen)
    navigation.navigate('Create', {
      screen: 'UploadReceipt'
    });
  };

  const handleViewAllExpenses = () => {
    navigation.navigate('History');
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={styles.compactHeader}>
          <View style={styles.compactHeaderContent}>
            <View style={styles.compactHeaderTop}>
              <View style={styles.compactAppBranding}>
                <View style={styles.compactAppIconContainer}>
                  <Icon name="money" size={16} color="#ffffff" />
                </View>
                <View style={styles.compactAppInfo}>
                  <Text style={styles.compactAppName}>Flotix</Text>
                  <Text style={styles.compactAppSubtitle}>Expense Tracker</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.compactProfileSection} onPress={() => navigation.navigate('Profile')}>
                <View style={styles.compactProfileAvatar}>
                  <Text style={styles.compactAvatarText}>
                    {state.user?.name?.charAt(0) || state.user?.email?.charAt(0) || 'U'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            {state.user && (
              <TouchableOpacity style={styles.compactWelcomeSection} onPress={() => navigation.navigate('Profile')}>
                <Text style={styles.compactWelcomeText}>
                  Hi {state.user.name?.split(' ')[0] || 'Driver'}
                </Text>
                <Text style={styles.compactDateText}>
                  {new Date().toLocaleDateString('de-DE', { 
                    weekday: 'long', 
                    day: 'numeric',
                    month: 'long' 
                  })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading your expenses...</Text>
          </View>
        ) : (
          <>
            {/* Modern Dashboard */}
            <View style={styles.dashboardContainer}>
              {/* Hero Stats Card */}
              <View style={styles.heroStatsCard}>
                <View style={styles.heroCardHeader}>
                  <View style={styles.heroIcon}>
                    <Icon name="money" size={24} color="#ffffff" />
                  </View>
                  <View style={styles.heroContent}>
                    <Text style={styles.heroAmount}>
                      {formatCurrency(stats.thisMonth, stats.currency)}
                    </Text>
                    <Text style={styles.heroLabel}>This Month</Text>
                  </View>
                  <View style={styles.trendIndicator}>
                    <Icon name="trend-up" size={16} color="#10b981" />
                  </View>
                </View>
                <View style={styles.heroSubStats}>
                  <View style={styles.subStat}>
                    <Text style={styles.subStatValue}>
                      {formatCurrency(stats.fuelExpenses, stats.currency)}
                    </Text>
                    <Text style={styles.subStatLabel}>Fuel (Month)</Text>
                  </View>
                  <View style={styles.subStat}>
                    <Text style={styles.subStatValue}>
                      {formatCurrency(stats.miscExpenses, stats.currency)}
                    </Text>
                    <Text style={styles.subStatLabel}>Misc (Month)</Text>
                  </View>
                </View>
              </View>

             
           
            </View>

            {/* Compact Vehicle Info Box */}
            <View style={styles.compactVehicleContainer}>
              <View style={styles.compactVehicleBox}>
                <View style={styles.compactVehicleLeft}>
                  <View style={styles.compactVehicleIcon}>
                    <Icon name="car" size={18} color="#ffffff" />
                  </View>
                  <View style={styles.compactVehicleInfo}>
                    <Text style={styles.compactVehicleTitle}>
                      {vehicleData ? 
                        `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}` : 
                        '2023 Toyota Camrysss'
                      }
                    </Text>
                    <Text style={styles.compactVehiclePlate}>
                      {vehicleData?.licensePlate || 'ABC-123'}
                    </Text>
                  </View>
                </View>
                <View style={styles.compactOdometerBox}>
                  <Text style={styles.compactOdometerValue}>
                    {vehicleData ? 
                      vehicleData.currentOdometer.toLocaleString() : 
                      '45,230'
                    }
                  </Text>
                  <Text style={styles.compactOdometerLabel}>KM</Text>
                </View>
              </View>
            </View>

            {/* Recent Activity - Clean & Compact Design */}
            <View style={styles.recentContainer}>
              <View style={styles.cleanSectionHeader}>
                <Text style={styles.cleanSectionTitle}>Recent Activity</Text>
                <TouchableOpacity style={styles.cleanViewAllButton} onPress={handleViewAllExpenses}>
                  <Text style={styles.cleanViewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {!expenses || expenses.length === 0 ? (
                <View style={styles.cleanEmptyState}>
                  <Text style={styles.cleanEmptyTitle}>No expenses yet</Text>
                  <Text style={styles.cleanEmptyText}>Start tracking your expenses</Text>
                </View>
              ) : (
                <View style={styles.cleanActivityList}>
                  {(expenses || []).slice(0, 5).map((expense) => (
                    <TouchableOpacity 
                      key={expense._id || expense.id} 
                      style={styles.cleanExpenseItem}
                      onPress={() => handleExpenseClick(expense)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.cleanExpenseCard}>
                        <View style={styles.cleanExpenseIcon}>
                          <Icon 
                            name={expense.type === 'FUEL' ? 'fuel' : 'receipt'} 
                            size={16} 
                            color={expense.type === 'FUEL' ? '#f59e0b' : '#6b7280'} 
                          />
                        </View>
                        
                        <View style={styles.cleanExpenseDetails}>
                          <Text style={styles.cleanExpenseName}>
                            {expense.merchant || `${expense.type} Expense`}
                          </Text>
                          <Text style={styles.cleanExpenseDate}>
                            {formatDisplayDate(expense.date)}
                          </Text>
                        </View>
                        
                        <Text style={styles.cleanExpenseAmount}>
                          {formatCurrency(expense.amountFinal, expense.currency)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>


            <Button
              title="Logout"
              onPress={handleLogout}
              variant="outline"
              style={styles.logoutButton}
            />
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={handleAddExpense}
        activeOpacity={0.8}
      >
        <Icon name="plus" size={28} color={theme.colors.surface} />
      </TouchableOpacity>

      {/* Expense Detail Modal */}
      <Modal 
        visible={showExpenseDetail} 
        animationType="slide" 
        transparent
        onRequestClose={() => setShowExpenseDetail(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.expenseDetailModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Expense Details</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowExpenseDetail(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedExpense && (
              <ScrollView style={styles.detailContent}>
                {/* Receipt Image */}
                {selectedExpense.receiptUrl && (
                  <View style={styles.receiptImageContainer}>
                    <Text style={styles.sectionTitle}>Receipt Image</Text>
                    <Image 
                      source={{ uri: selectedExpense.receiptUrl }}
                      style={styles.receiptImage}
                      resizeMode="contain"
                      onError={() => console.log('Failed to load receipt image')}
                    />
                  </View>
                )}

                {/* Expense Details */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Expense Information</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type:</Text>
                    <Text style={styles.detailValue}>{selectedExpense.type}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount:</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(selectedExpense.amountFinal, selectedExpense.currency)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>
                      {formatDisplayDate(selectedExpense.date)}
                    </Text>
                  </View>

                  {selectedExpense.merchant && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Merchant:</Text>
                      <Text style={styles.detailValue}>{selectedExpense.merchant}</Text>
                    </View>
                  )}

                  {selectedExpense.category && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Category:</Text>
                      <Text style={styles.detailValue}>{selectedExpense.category}</Text>
                    </View>
                  )}

                  {selectedExpense.notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notes:</Text>
                      <Text style={styles.detailValue}>{selectedExpense.notes}</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created:</Text>
                    <Text style={styles.detailValue}>
                      {formatDisplayDate(selectedExpense.createdAt)}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
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
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 100, // Space for FAB
  },
  header: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    marginHorizontal: -theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginTop: 2,
  },
  profileSection: {
    alignItems: 'center',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  welcomeSection: {
    alignItems: 'flex-start',
  },
  welcomeText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
  },
  summaryContainer: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: theme.spacing.md,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  primaryStatsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  primaryStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: theme.spacing.lg,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  statIconText: {
    fontSize: 20,
  },
  statContent: {
    flex: 1,
  },
  primaryStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  primaryStatLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  secondaryStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: theme.spacing.md,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  statIconSmallText: {
    fontSize: 14,
  },
  statContentSmall: {
    flex: 1,
  },
  secondaryStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 1,
  },
  secondaryStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  recentContainer: {
    marginBottom: theme.spacing.xl,
  },
  expenseItem: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseType: {
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  expenseDate: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  expenseCategory: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
  expenseAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: theme.fontSize.body,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  manualBadge: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.small,
    marginTop: theme.spacing.xs,
  },
  manualBadgeText: {
    fontSize: theme.fontSize.small - 2,
    color: theme.colors.surface,
    fontWeight: '500',
  },
  expenseNotes: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: theme.spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  emptyStateTitle: {
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyStateText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionsContainer: {
    marginBottom: theme.spacing.xl,
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginRight: theme.spacing.md,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  actionDescription: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  logoutButton: {
    marginTop: theme.spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 24,
    color: theme.colors.surface,
  },
  fabContent: {
    alignItems: 'center',
  },
  fabText: {
    fontSize: 10,
    color: theme.colors.surface,
    fontWeight: '600',
    marginTop: 2,
  },
  // Modern expense card styles
  expenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  expenseLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  expenseTypeEmoji: {
    fontSize: 18,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  merchantText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  expenseRightContent: {
    alignItems: 'flex-end',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseDetailModal: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSize.title,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  detailContent: {
    maxHeight: '100%',
  },
  receiptImageContainer: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  receiptImage: {
    width: '100%',
    height: 300,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    marginTop: theme.spacing.sm,
  },
  detailSection: {
    padding: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '20',
  },
  detailLabel: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  
  // Modern Header Styles
  modernHeader: {
    marginHorizontal: -theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  headerGradient: {
    backgroundColor: '#667eea',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  appBranding: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  appIcon: {
    fontSize: 20,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    position: 'relative',
  },
  notificationIcon: {
    fontSize: 18,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: '#ff4444',
    borderRadius: 4,
  },
  modernProfileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  motivationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  
  // Dashboard Container
  dashboardContainer: {
    marginBottom: theme.spacing.xl,
  },
  
  // Hero Stats Card
  heroStatsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f4f8',
  },
  heroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  heroIconText: {
    fontSize: 24,
  },
  heroContent: {
    flex: 1,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  trendIndicator: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  trendIcon: {
    fontSize: 16,
  },
  heroSubStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  subStat: {
    alignItems: 'center',
  },
  subStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  subStatLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  
  // Category Cards
  categoryCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  fuelCategoryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  miscCategoryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#8b5cf6',
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryStats: {
    marginBottom: 12,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  categoryLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  categoryProgress: {
    height: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  fuelProgress: {
    backgroundColor: '#f59e0b',
    width: '65%',
  },
  miscProgress: {
    backgroundColor: '#8b5cf6',
    width: '35%',
  },
  
  // Modern Section Header
  modernSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modernSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  modernSectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginRight: 4,
  },
  viewAllIcon: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: 'bold',
  },
  
  // Clean & Compact Recent Activity Styles
  cleanSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cleanSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  cleanViewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  cleanViewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667eea',
  },
  
  // Clean Empty State
  cleanEmptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  cleanEmptyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  cleanEmptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  
  // Clean Activity List
  cleanActivityList: {
    gap: 8,
  },
  cleanExpenseItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cleanExpenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cleanExpenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cleanExpenseEmoji: {
    fontSize: 16,
  },
  cleanExpenseDetails: {
    flex: 1,
  },
  cleanExpenseName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  cleanExpenseDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  cleanExpenseAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
  },
  
  // Compact Header Styles
  compactHeader: {
    marginHorizontal: -theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  compactHeaderContent: {
    backgroundColor: '#667eea',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 16,
    paddingBottom: 16,
  },
  compactHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactAppBranding: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactAppIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compactAppIcon: {
    fontSize: 16,
  },
  compactAppInfo: {
    justifyContent: 'center',
  },
  compactAppName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  compactAppSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginTop: 1,
  },
  compactProfileSection: {
    alignItems: 'center',
  },
  compactProfileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  compactAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  compactWelcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactWelcomeText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  compactDateText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  
  // Compact Vehicle Info Styles
  compactVehicleContainer: {
    marginBottom: theme.spacing.md,
  },
  compactVehicleBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  compactVehicleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactVehicleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#22d3ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compactVehicleEmoji: {
    fontSize: 18,
  },
  compactVehicleInfo: {
    flex: 1,
  },
  compactVehicleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  compactVehiclePlate: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6366f1',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  compactOdometerBox: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compactOdometerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  compactOdometerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.5,
  },
});

export default HomeScreen;