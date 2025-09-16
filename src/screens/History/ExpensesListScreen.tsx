import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { theme } from '../../styles/theme';
import { useExpense } from '../../state/expenseSlice';
import { expensesApi, Expense } from '../../api/expenses';
import { formatCurrency } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/date';
import Toast from '../../components/Toast';
import Icon from '../../components/Icon';

const ExpensesListScreen: React.FC = () => {
  const { state, setExpenses, setLoading, setError } = useExpense();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: '' as 'Fuel' | 'Misc' | '',
    dateRange: '' as 'all' | 'today' | 'week' | 'month' | 'year',
    sortBy: 'date' as 'date' | 'amount' | 'merchant',
    sortOrder: 'desc' as 'asc' | 'desc',
    page: 1,
  });
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

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [filters])
  );

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        ...(filters.type && { type: filters.type.toUpperCase() as 'FUEL' | 'MISC' }),
        page: filters.page,
        pageSize: 20,
      };
      
      const response = await expensesApi.getList(params);
      setExpenses(response.items);
    } catch (error) {
      console.error('Load expenses error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load expenses';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  const handleFilterChange = (type: 'Fuel' | 'Misc' | '') => {
    setFilters(prev => ({ ...prev, type, page: 1 }));
  };

  const getDateRange = (range: string) => {
    const now = new Date();
    let startDate = '';
    
    switch (range) {
      case 'today':
        startDate = now.toISOString().split('T')[0];
        return { startDate, endDate: startDate };
      case 'week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        return { startDate: weekStart.toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] };
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: monthStart.toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] };
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return { startDate: yearStart.toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] };
      default:
        return {};
    }
  };

  const getFilteredAndSortedExpenses = () => {
    let filteredExpenses = [...state.expenses];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredExpenses = filteredExpenses.filter(expense =>
        expense.merchant?.toLowerCase().includes(query) ||
        expense.notes?.toLowerCase().includes(query) ||
        expense.category?.toLowerCase().includes(query) ||
        expense.type.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filters.type) {
      filteredExpenses = filteredExpenses.filter(expense => 
        expense.type === filters.type || expense.type.toUpperCase() === filters.type.toUpperCase()
      );
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const { startDate, endDate } = getDateRange(filters.dateRange);
      if (startDate && endDate) {
        filteredExpenses = filteredExpenses.filter(expense => {
          const expenseDate = expense.date.split('T')[0];
          return expenseDate >= startDate && expenseDate <= endDate;
        });
      }
    }

    // Sorting
    filteredExpenses.sort((a, b) => {
      let compareValue = 0;
      
      switch (filters.sortBy) {
        case 'date':
          compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          compareValue = (a.amountFinal || 0) - (b.amountFinal || 0);
          break;
        case 'merchant':
          compareValue = (a.merchant || '').localeCompare(b.merchant || '');
          break;
        default:
          compareValue = 0;
      }
      
      return filters.sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filteredExpenses;
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      dateRange: 'all',
      sortBy: 'date',
      sortOrder: 'desc',
      page: 1,
    });
    setSearchQuery('');
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.type) count++;
    if (filters.dateRange && filters.dateRange !== 'all') count++;
    if (searchQuery.trim()) count++;
    return count;
  };

  const ExpenseItem: React.FC<{ expense: Expense }> = ({ expense }) => {
    const isManual = !expense.ocr || !expense.amountExtracted;
    
    const handlePress = () => {
      (navigation as any).navigate('ExpenseDetail', { expenseId: expense._id || expense.id });
    };
    
    return (
      <TouchableOpacity style={styles.expenseItem} activeOpacity={0.7} onPress={handlePress}>
        <View style={styles.expenseContent}>
          <View style={styles.expenseRow}>
            <View style={styles.typeIconContainer}>
              <Icon 
                name={expense.type === 'FUEL' || expense.type === 'Fuel' ? 'fuel' : 'receipt'} 
                size={20} 
                color={expense.type === 'FUEL' || expense.type === 'Fuel' ? '#f59e0b' : '#8b5cf6'} 
              />
            </View>
            
            <View style={styles.expenseMainInfo}>
              <View style={styles.expenseTopRow}>
                <Text style={styles.expenseType}>{expense.type}</Text>
                <Text style={styles.amountText}>
                  {formatCurrency(expense.amountFinal, expense.currency)}
                </Text>
              </View>
              <View style={styles.expenseBottomRow}>
                <Text style={styles.expenseDate}>{formatDisplayDate(expense.date)}</Text>
                <View style={styles.expenseIndicators}>
                  {expense.receiptUrl && (
                    <Icon name="camera" size={12} color={theme.colors.textSecondary} />
                  )}
                  {isManual && (
                    <View style={styles.manualIndicator}>
                      <Text style={styles.manualIndicatorText}>M</Text>
                    </View>
                  )}
                </View>
              </View>
              {expense.merchant && (
                <Text style={styles.merchantText} numberOfLines={1}>
                  {expense.merchant}
                </Text>
              )}
            </View>
            
            <Icon name="arrow-right" size={16} color={theme.colors.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No expenses found</Text>
      <Text style={styles.emptyStateText}>
        {filters.type
          ? `No ${filters.type.toLowerCase()} expenses to display`
          : 'Start by creating your first expense'}
      </Text>
    </View>
  );

  const filteredExpenses = getFilteredAndSortedExpenses();
  const activeFiltersCount = getActiveFiltersCount();

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search expenses..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Icon name="close" size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={[styles.filterToggleButton, activeFiltersCount > 0 && styles.filterToggleButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Icon name="settings" size={16} color={activeFiltersCount > 0 ? theme.colors.surface : theme.colors.textSecondary} />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Filters */}
      <View style={styles.quickFiltersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickFiltersScroll}>
          <TouchableOpacity
            style={[styles.quickFilterChip, !filters.type && styles.quickFilterChipActive]}
            onPress={() => handleFilterChange('')}
          >
            <Text style={[styles.quickFilterText, !filters.type && styles.quickFilterTextActive]}>
              All Types
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickFilterChip, filters.type === 'Fuel' && styles.quickFilterChipActive]}
            onPress={() => handleFilterChange('Fuel')}
          >
            <View style={styles.quickFilterContent}>
              <Icon name="fuel" size={14} color={filters.type === 'Fuel' ? theme.colors.surface : theme.colors.textSecondary} />
              <Text style={[styles.quickFilterText, filters.type === 'Fuel' && styles.quickFilterTextActive]}>Fuel</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickFilterChip, filters.type === 'Misc' && styles.quickFilterChipActive]}
            onPress={() => handleFilterChange('Misc')}
          >
            <View style={styles.quickFilterContent}>
              <Icon name="target" size={14} color={filters.type === 'Misc' ? theme.colors.surface : theme.colors.textSecondary} />
              <Text style={[styles.quickFilterText, filters.type === 'Misc' && styles.quickFilterTextActive]}>Misc</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
        
        {activeFiltersCount > 0 && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>Clear ({activeFiltersCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results Summary */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} found
        </Text>
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => {
            setFilters(prev => ({
              ...prev,
              sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
            }));
          }}
        >
          <View style={styles.sortButtonContent}>
            <Text style={styles.sortButtonText}>{filters.sortBy}</Text>
            <Icon name={filters.sortOrder === 'asc' ? 'arrow-left' : 'arrow-right'} size={12} color={theme.colors.text} style={{ transform: [{ rotate: filters.sortOrder === 'asc' ? '-90deg' : '90deg' }] }} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Expenses List */}
      <FlatList
        data={filteredExpenses}
        renderItem={({ item }) => <ExpenseItem expense={item} />}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={!state.isLoading ? renderEmptyState : null}
        ListFooterComponent={
          state.isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={styles.loader}
            />
          ) : null
        }
      />

      {/* Advanced Filters Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters & Sort</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.modalCloseButton}>
                <Icon name="close" size={16} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {/* Date Range Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Date Range</Text>
                <View style={styles.filterOptions}>
                  {['all', 'today', 'week', 'month', 'year'].map((range) => (
                    <TouchableOpacity
                      key={range}
                      style={[
                        styles.filterOption,
                        filters.dateRange === range && styles.filterOptionActive
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, dateRange: range as any }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.dateRange === range && styles.filterOptionTextActive
                      ]}>
                        {range === 'all' ? 'All Time' : range.charAt(0).toUpperCase() + range.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sort Options */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Sort By</Text>
                <View style={styles.filterOptions}>
                  {[
                    { key: 'date', label: 'Date' },
                    { key: 'amount', label: 'Amount' },
                    { key: 'merchant', label: 'Merchant' }
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.filterOption,
                        filters.sortBy === option.key && styles.filterOptionActive
                      ]}
                      onPress={() => setFilters(prev => ({ ...prev, sortBy: option.key as any }))}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.sortBy === option.key && styles.filterOptionTextActive
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sort Order */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Sort Order</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filters.sortOrder === 'desc' && styles.filterOptionActive
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, sortOrder: 'desc' }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.sortOrder === 'desc' && styles.filterOptionTextActive
                    ]}>
                      Newest First
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filters.sortOrder === 'asc' && styles.filterOptionActive
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, sortOrder: 'asc' }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.sortOrder === 'asc' && styles.filterOptionTextActive
                    ]}>
                      Oldest First
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearAllButton} onPress={clearFilters}>
                <Text style={styles.clearAllButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyButton} 
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: theme.colors.background,
  },
  
  // Search Bar Styles
  searchContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    paddingVertical: 4,
  },
  clearSearchButton: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  quickFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterToggleButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterToggleButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterIcon: {
    fontSize: 16,
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  
  // Quick Filters
  quickFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  quickFiltersScroll: {
    flex: 1,
  },
  quickFilterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  quickFilterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  quickFilterText: {
    fontSize: theme.fontSize.small,
    fontWeight: '500',
    color: theme.colors.text,
  },
  quickFilterTextActive: {
    color: theme.colors.surface,
  },
  clearFiltersButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  clearFiltersText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.error,
    fontWeight: '500',
  },
  
  // Results Summary
  resultsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resultsText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  sortButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: theme.colors.background,
  },
  sortButtonText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.text,
    fontWeight: '500',
  },
  
  // Expense List
  listContainer: {
    paddingVertical: theme.spacing.sm,
  },
  expenseItem: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.medium,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  expenseContent: {
    padding: theme.spacing.md,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  typeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseMainInfo: {
    flex: 1,
  },
  expenseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  expenseBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseType: {
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  expenseDate: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
  },
  amountText: {
    fontSize: theme.fontSize.body,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  merchantText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  expenseIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  manualIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyStateTitle: {
    fontSize: theme.fontSize.title,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyStateText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  loader: {
    paddingVertical: theme.spacing.lg,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.large,
    borderTopRightRadius: theme.borderRadius.large,
    maxHeight: '80%',
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
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  modalContent: {
    maxHeight: 400,
  },
  filterSection: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterSectionTitle: {
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterOptionText: {
    fontSize: theme.fontSize.small,
    fontWeight: '500',
    color: theme.colors.text,
  },
  filterOptionTextActive: {
    color: theme.colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  clearAllButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  clearAllButtonText: {
    fontSize: theme.fontSize.body,
    fontWeight: '500',
    color: theme.colors.text,
  },
  applyButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    color: theme.colors.surface,
  },
});

export default ExpensesListScreen;