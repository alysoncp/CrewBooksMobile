import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiRequest } from '@/lib/api';
import { formatCurrency, formatDate, getCategoryLabel, getTodayLocalDateString, getYearFromDateString } from '@/lib/format';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EXPENSE_CATEGORIES = [
  'home_office_expenses',
  'motor_vehicle_expenses',
  'advertising',
  'business_taxes',
  'commissions_agent_fees',
  'delivery_freight',
  'fuel_costs',
  'insurance',
  'licenses_memberships',
  'management_admin_fees',
  'meals_entertainment',
  'office_expenses',
  'office_supplies',
  'professional_fees',
  'property_tax',
  'rent',
  'repairs_maintenance',
  'salaries_wages',
  'training',
  'travel_expenses',
  'utilities',
] as const;

const VEHICLE_SUBCATEGORIES = [
  { id: 'fuel', label: 'Fuel' },
  { id: 'electric_vehicle_charging', label: 'Electric Vehicle Charging' },
  { id: 'maintenance', label: 'Maintenance & Repairs' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'registration', label: 'Registration & Licensing' },
  { id: 'parking', label: 'Parking & Tolls' },
  { id: 'lease_payment', label: 'Lease or Loan Payment' },
  { id: 'other_vehicle', label: 'Other' },
] as const;

const HOME_OFFICE_SUBCATEGORIES = [
  { id: 'heat', label: 'Heat' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'mortgage_interest', label: 'Mortgage Interest' },
  { id: 'property_taxes', label: 'Property Taxes' },
  { id: 'rent', label: 'Rent' },
] as const;

interface Expense {
  id: string;
  amount: number | string;
  baseCost?: number | string;
  gstAmount?: number | string;
  pstAmount?: number | string;
  date: string;
  title?: string;
  category: string;
  subcategory?: string;
  vehicleId?: string;
  vendor?: string;
  description?: string;
  isTaxDeductible?: boolean;
  [key: string]: any;
}

interface Vehicle {
  id: string;
  name: string;
  [key: string]: any;
}

interface ExpenseFormData {
  baseCost: string;
  total: string;
  gstAmount: string;
  pstAmount: string;
  gstIncluded: boolean;
  pstIncluded: boolean;
  date: string;
  title: string;
  category: string;
  subcategory: string;
  vehicleId: string;
  vendor: string;
  description: string;
  isTaxDeductible: boolean;
}

export default function Expenses() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const hasGstNumber = user?.hasGstNumber === true;
  const taxYear = new Date().getFullYear();

  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lastEditedField, setLastEditedField] = useState<'baseCost' | 'total' | 'gstAmount' | 'pstAmount' | null>(null);

  const [formData, setFormData] = useState<ExpenseFormData>({
    baseCost: '',
    total: '',
    gstAmount: '',
    pstAmount: '',
    gstIncluded: true,
    pstIncluded: true,
    date: getTodayLocalDateString(),
    title: '',
    category: '',
    subcategory: '',
    vehicleId: '',
    vendor: '',
    description: '',
    isTaxDeductible: true,
  });

  useEffect(() => {
    fetchExpenses();
    fetchVehicles();
  }, []);

  // Auto-calculate totals when fields change
  useEffect(() => {
    if (lastEditedField === 'baseCost' && formData.baseCost) {
      const base = parseFloat(formData.baseCost) || 0;
      const gst = parseFloat(formData.gstAmount) || 0;
      const pst = parseFloat(formData.pstAmount) || 0;
      const total = base + gst + pst;
      setFormData((prev) => ({ ...prev, total: total.toFixed(2) }));
    } else if (lastEditedField === 'total' && formData.total) {
      const total = parseFloat(formData.total) || 0;
      if (formData.gstIncluded && formData.pstIncluded) {
        const base = total / 1.12;
        const gst = base * 0.05;
        const pst = base * 0.07;
        setFormData((prev) => ({
          ...prev,
          baseCost: base.toFixed(2),
          gstAmount: gst.toFixed(2),
          pstAmount: pst.toFixed(2),
        }));
      } else if (formData.gstIncluded) {
        const base = total / 1.05;
        const gst = base * 0.05;
        setFormData((prev) => ({
          ...prev,
          baseCost: base.toFixed(2),
          gstAmount: gst.toFixed(2),
          pstAmount: '',
        }));
      } else if (formData.pstIncluded) {
        const base = total / 1.07;
        const pst = base * 0.07;
        setFormData((prev) => ({
          ...prev,
          baseCost: base.toFixed(2),
          gstAmount: '',
          pstAmount: pst.toFixed(2),
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          baseCost: total.toFixed(2),
          gstAmount: '',
          pstAmount: '',
        }));
      }
    } else if ((lastEditedField === 'gstAmount' || lastEditedField === 'pstAmount') && formData.baseCost) {
      const base = parseFloat(formData.baseCost) || 0;
      const gst = parseFloat(formData.gstAmount) || 0;
      const pst = parseFloat(formData.pstAmount) || 0;
      const total = base + gst + pst;
      setFormData((prev) => ({ ...prev, total: total.toFixed(2) }));
    }
  }, [formData.baseCost, formData.total, formData.gstAmount, formData.pstAmount, formData.gstIncluded, formData.pstIncluded, lastEditedField]);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet<Expense[]>('/api/expenses');
      setExpenseList(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const data = await apiGet<Vehicle[]>('/api/vehicles');
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const filteredExpenses = useMemo(() => {
    return (expenseList || []).filter((item) => {
      const itemYear = getYearFromDateString(item.date);
      if (itemYear !== taxYear) return false;

      const searchLower = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(searchLower) ||
        item.vendor?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        getCategoryLabel(item.category).toLowerCase().includes(searchLower)
      );
    });
  }, [expenseList, taxYear, searchQuery]);

  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const deductibleExpenses = filteredExpenses.reduce((sum, item) => {
    const baseCost = item.baseCost ? parseFloat(item.baseCost.toString()) : 0;
    const pstAmount = item.pstAmount ? parseFloat(item.pstAmount.toString()) : 0;
    return sum + baseCost + pstAmount;
  }, 0);
  const totalGstCredits = filteredExpenses.reduce((sum, item) => {
    const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;
    return sum + gstAmount;
  }, 0);

  const handleSubmit = async () => {
    if (!formData.category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!formData.date) {
      Alert.alert('Error', 'Please enter a date');
      return;
    }
    if (!formData.baseCost && !formData.total) {
      Alert.alert('Error', 'Please enter either base cost or total amount');
      return;
    }
    if (formData.category === 'motor_vehicle_expenses' && !formData.vehicleId) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }

    try {
      setIsSubmitting(true);
      const baseCost = formData.baseCost ? parseFloat(formData.baseCost) : 0;
      const gstAmount = formData.gstIncluded && formData.gstAmount ? parseFloat(formData.gstAmount) : 0;
      const pstAmount = formData.pstIncluded && formData.pstAmount ? parseFloat(formData.pstAmount) : 0;
      const amount = formData.total ? parseFloat(formData.total) : baseCost + gstAmount + pstAmount;

      const payload: any = {
        amount: amount.toString(),
        baseCost: baseCost.toString(),
        gstAmount: gstAmount.toString(),
        pstAmount: pstAmount.toString(),
        date: formData.date,
        title: formData.title || null,
        category: formData.category,
        subcategory: formData.subcategory || null,
        vehicleId: formData.vehicleId || null,
        vendor: formData.vendor || null,
        description: formData.description || null,
        isTaxDeductible: formData.isTaxDeductible,
      };

      if (editingExpense) {
        await apiRequest('PATCH', `/api/expenses/${editingExpense.id}`, payload);
        Alert.alert('Success', 'Expense updated successfully');
      } else {
        await apiRequest('POST', '/api/expenses', payload);
        Alert.alert('Success', 'Expense added successfully');
      }

      await fetchExpenses();
      setIsModalOpen(false);
      setEditingExpense(null);
      setFormData({
        baseCost: '',
        total: '',
        gstAmount: '',
        pstAmount: '',
        gstIncluded: true,
        pstIncluded: true,
        date: getTodayLocalDateString(),
        title: '',
        category: '',
        subcategory: '',
        vehicleId: '',
        vendor: '',
        description: '',
        isTaxDeductible: true,
      });
      setLastEditedField(null);
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    const baseCost = expense.baseCost ? parseFloat(expense.baseCost.toString()) : null;
    const gstAmount = expense.gstAmount ? parseFloat(expense.gstAmount.toString()) : null;
    const pstAmount = expense.pstAmount ? parseFloat(expense.pstAmount.toString()) : null;
    const totalAmount = parseFloat(expense.amount.toString());

    if (baseCost !== null && baseCost > 0) {
      setFormData({
        baseCost: baseCost.toFixed(2),
        total: totalAmount.toFixed(2),
        gstAmount: gstAmount && gstAmount > 0 ? gstAmount.toFixed(2) : '',
        pstAmount: pstAmount && pstAmount > 0 ? pstAmount.toFixed(2) : '',
        gstIncluded: (gstAmount !== null && gstAmount > 0),
        pstIncluded: (pstAmount !== null && pstAmount > 0),
        date: expense.date,
        title: expense.title || '',
        category: expense.category,
        subcategory: expense.subcategory || '',
        vehicleId: expense.vehicleId || '',
        vendor: expense.vendor || '',
        description: expense.description || '',
        isTaxDeductible: expense.isTaxDeductible ?? true,
      });
      setLastEditedField('baseCost');
    } else {
      setFormData({
        baseCost: '',
        total: totalAmount.toFixed(2),
        gstAmount: '',
        pstAmount: '',
        gstIncluded: false,
        pstIncluded: false,
        date: expense.date,
        title: expense.title || '',
        category: expense.category,
        subcategory: expense.subcategory || '',
        vehicleId: expense.vehicleId || '',
        vendor: expense.vendor || '',
        description: expense.description || '',
        isTaxDeductible: expense.isTaxDeductible ?? true,
      });
      setLastEditedField('total');
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete expense entry?',
      'This will permanently remove this expense record. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteId(id);
              await apiRequest('DELETE', `/api/expenses/${id}`);
              await fetchExpenses();
              Alert.alert('Success', 'Expense deleted successfully');
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'Failed to delete expense. Please try again.');
            } finally {
              setDeleteId(null);
            }
          },
        },
      ]
    );
  };

  const getSubcategories = () => {
    if (formData.category === 'motor_vehicle_expenses') {
      return VEHICLE_SUBCATEGORIES;
    }
    if (formData.category === 'home_office_expenses') {
      return HOME_OFFICE_SUBCATEGORIES;
    }
    return [];
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const baseCost = item.baseCost ? parseFloat(item.baseCost.toString()) : 0;
    const pstAmount = item.pstAmount ? parseFloat(item.pstAmount.toString()) : 0;
    const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;
    const deductibleAmount = baseCost + pstAmount;

    return (
      <View style={[styles.expenseCard, isDark && styles.expenseCardDark]}>
        <View style={styles.expenseCardHeader}>
          <View style={styles.expenseCardHeaderLeft}>
            <Text style={[styles.expenseCardTitle, isDark && styles.expenseCardTitleDark]}>
              {item.title || 'Untitled Expense'}
            </Text>
            <Text style={[styles.expenseCardDate, isDark && styles.expenseCardDateDark]}>
              {formatDate(item.date)}
            </Text>
          </View>
          <Text style={styles.expenseCardAmount}>-{formatCurrency(item.amount)}</Text>
        </View>
        
        <View style={styles.expenseCardBody}>
          <View style={styles.expenseCardRow}>
            <View style={[styles.badge, isDark && styles.badgeDark]}>
              <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
                {getCategoryLabel(item.category)}
              </Text>
            </View>
            {item.vendor && (
              <Text style={[styles.expenseCardVendor, isDark && styles.expenseCardVendorDark]}>
                {item.vendor}
              </Text>
            )}
          </View>
          
          {item.description && (
            <Text style={[styles.expenseCardDescription, isDark && styles.expenseCardDescriptionDark]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          <View style={[styles.expenseCardFooter, isDark && styles.expenseCardFooterDark]}>
            <View style={styles.expenseCardStats}>
              <View style={styles.expenseCardStat}>
                <Text style={[styles.expenseCardStatLabel, isDark && styles.expenseCardStatLabelDark]}>Deductible</Text>
                <Text style={[styles.expenseCardStatValue, isDark && styles.expenseCardStatValueDark]}>
                  {formatCurrency(deductibleAmount)}
                </Text>
              </View>
              {gstAmount > 0 && (
                <View style={styles.expenseCardStat}>
                  <Text style={[styles.expenseCardStatLabel, isDark && styles.expenseCardStatLabelDark]}>GST</Text>
                  <Text style={[styles.expenseCardStatValue, styles.expenseCardStatValueBlue, isDark && styles.expenseCardStatValueBlueDark]}>
                    {formatCurrency(gstAmount)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.expenseCardActions}>
              <TouchableOpacity
                onPress={() => handleEdit(item)}
                style={styles.expenseActionButton}
              >
                <MaterialIcons name="edit" size={20} color={isDark ? '#9BA1A6' : '#666'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                disabled={deleteId === item.id}
                style={styles.expenseActionButton}
              >
                {deleteId === item.id ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <MaterialIcons name="delete" size={20} color={isDark ? '#9BA1A6' : '#666'} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]} contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Expenses</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            Track your business expenses and deductions
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingExpense(null);
            setFormData({
              baseCost: '',
              total: '',
              gstAmount: '',
              pstAmount: '',
              gstIncluded: true,
              pstIncluded: true,
              date: getTodayLocalDateString(),
              title: '',
              category: '',
              subcategory: '',
              vehicleId: '',
              vendor: '',
              description: '',
              isTaxDeductible: true,
            });
            setLastEditedField(null);
            setIsModalOpen(true);
          }}
        >
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, isDark && styles.statCardDark]}>
          <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>Total Expenses</Text>
          <Text style={[styles.statCardValue, isDark && styles.statCardValueDark]}>
            {formatCurrency(totalExpenses)}
          </Text>
        </View>
        <View style={[styles.statCard, isDark && styles.statCardDark]}>
          <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>Tax Deductible</Text>
          <Text style={[styles.statCardValue, styles.statCardValueGreen, isDark && styles.statCardValueGreenDark]}>
            {formatCurrency(deductibleExpenses)}
          </Text>
        </View>
        <View style={[styles.statCard, isDark && styles.statCardDark]}>
          <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>Total GST Credits</Text>
          <Text style={[styles.statCardValue, styles.statCardValueBlue, isDark && styles.statCardValueBlueDark]}>
            {formatCurrency(totalGstCredits)}
          </Text>
        </View>
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Expense History</Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              All recorded business expenses for {taxYear}
            </Text>
          </View>
          <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
            <MaterialIcons name="search" size={18} color={isDark ? '#9BA1A6' : '#666'} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, isDark && styles.searchInputDark]}
              placeholder="Search expenses..."
              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} style={styles.loader} />
        ) : filteredExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt" size={48} color={isDark ? '#9BA1A6' : '#666'} />
            <Text style={[styles.emptyStateTitle, isDark && styles.emptyStateTitleDark]}>
              No expenses recorded
            </Text>
            <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>
              {searchQuery ? 'No results match your search' : 'Add your first expense to get started'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredExpenses}
            renderItem={renderExpenseItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.expenseCardSeparator} />}
          />
        )}
      </View>

      {/* Add/Edit Expense Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={[styles.modalContainer, isDark && styles.modalContainerDark]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Cost Breakdown Section */}
            <View style={[styles.costBreakdownSection, isDark && styles.costBreakdownSectionDark]}>
              <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Cost Breakdown</Text>

              <View style={styles.formGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Base Cost</Text>
                <View style={styles.currencyInput}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={formData.baseCost}
                    onChangeText={(text) => {
                      setFormData({ ...formData, baseCost: text });
                      setLastEditedField('baseCost');
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={[styles.helperText, isDark && styles.helperTextDark]}>Cost before taxes</Text>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Switch
                    value={formData.gstIncluded}
                    onValueChange={(value) => {
                      setFormData({ ...formData, gstIncluded: value, gstAmount: value ? formData.gstAmount : '' });
                    }}
                    trackColor={{ false: '#e5e7eb', true: '#0a7ea4' }}
                    thumbColor={formData.gstIncluded ? '#fff' : '#f3f4f6'}
                  />
                  <Text style={[styles.label, isDark && styles.labelDark]}>GST Amount</Text>
                </View>
                <View style={styles.currencyInput}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark, !formData.gstIncluded && styles.inputDisabled]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={formData.gstAmount}
                    onChangeText={(text) => {
                      setFormData({ ...formData, gstAmount: text });
                      setLastEditedField('gstAmount');
                    }}
                    keyboardType="decimal-pad"
                    editable={formData.gstIncluded}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Switch
                    value={formData.pstIncluded}
                    onValueChange={(value) => {
                      setFormData({ ...formData, pstIncluded: value, pstAmount: value ? formData.pstAmount : '' });
                    }}
                    trackColor={{ false: '#e5e7eb', true: '#0a7ea4' }}
                    thumbColor={formData.pstIncluded ? '#fff' : '#f3f4f6'}
                  />
                  <Text style={[styles.label, isDark && styles.labelDark]}>PST Amount</Text>
                </View>
                <View style={styles.currencyInput}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark, !formData.pstIncluded && styles.inputDisabled]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={formData.pstAmount}
                    onChangeText={(text) => {
                      setFormData({ ...formData, pstAmount: text });
                      setLastEditedField('pstAmount');
                    }}
                    keyboardType="decimal-pad"
                    editable={formData.pstIncluded}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Total</Text>
                <View style={styles.currencyInput}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, styles.inputBold, isDark && styles.inputDark]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={formData.total}
                    onChangeText={(text) => {
                      setFormData({ ...formData, total: text });
                      setLastEditedField('total');
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={[styles.helperText, isDark && styles.helperTextDark]}>Total amount including taxes</Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Date *</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.date}
                onChangeText={(text) => setFormData({ ...formData, date: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Title</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="e.g., Office Supplies Purchase"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Category *</Text>
              <TouchableOpacity
                style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
                  {formData.category ? getCategoryLabel(formData.category) : 'Select category'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
              </TouchableOpacity>
            </View>

            {formData.category === 'motor_vehicle_expenses' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Vehicle *</Text>
                  <TouchableOpacity
                    style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
                    onPress={() => setShowVehiclePicker(true)}
                  >
                    <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
                      {formData.vehicleId
                        ? vehicles.find((v) => v.id === formData.vehicleId)?.name || 'Select vehicle'
                        : 'Select vehicle'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
                  </TouchableOpacity>
                  {vehicles.length === 0 && (
                    <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                      No vehicles found. Add a vehicle in expense settings.
                    </Text>
                  )}
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Expense Type</Text>
                  <TouchableOpacity
                    style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
                    onPress={() => setShowSubcategoryPicker(true)}
                  >
                    <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
                      {formData.subcategory
                        ? getSubcategories().find((s) => s.id === formData.subcategory)?.label || 'Select type'
                        : 'Select type'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {formData.category === 'home_office_expenses' && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Expense Type</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
                  onPress={() => setShowSubcategoryPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
                    {formData.subcategory
                      ? getSubcategories().find((s) => s.id === formData.subcategory)?.label || 'Select type'
                      : 'Select type'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Vendor</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="e.g., Best Buy, Air Canada"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.vendor}
                onChangeText={(text) => setFormData({ ...formData, vendor: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea, isDark && styles.inputDark]}
                placeholder="Additional details..."
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingExpense ? 'Update Expense' : 'Save Expense'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Picker Modal */}
        <Modal
          visible={showCategoryPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCategoryPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowCategoryPicker(false)}
          >
            <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
              <ScrollView>
                {EXPENSE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={styles.pickerOption}
                    onPress={() => {
                      setFormData({ ...formData, category, subcategory: '', vehicleId: '' });
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, isDark && styles.pickerOptionTextDark]}>
                      {getCategoryLabel(category)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Subcategory Picker Modal */}
        <Modal
          visible={showSubcategoryPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSubcategoryPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowSubcategoryPicker(false)}
          >
            <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
              <ScrollView>
                {getSubcategories().map((subcat) => (
                  <TouchableOpacity
                    key={subcat.id}
                    style={styles.pickerOption}
                    onPress={() => {
                      setFormData({ ...formData, subcategory: subcat.id });
                      setShowSubcategoryPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, isDark && styles.pickerOptionTextDark]}>
                      {subcat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Vehicle Picker Modal */}
        <Modal
          visible={showVehiclePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowVehiclePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowVehiclePicker(false)}
          >
            <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
              {vehicles.length === 0 ? (
                <View style={styles.pickerOption}>
                  <Text style={[styles.pickerOptionText, isDark && styles.pickerOptionTextDark]}>
                    No vehicles found
                  </Text>
                </View>
              ) : (
                <ScrollView>
                  {vehicles.map((vehicle) => (
                    <TouchableOpacity
                      key={vehicle.id}
                      style={styles.pickerOption}
                      onPress={() => {
                        setFormData({ ...formData, vehicleId: vehicle.id });
                        setShowVehiclePicker(false);
                      }}
                    >
                      <Text style={[styles.pickerOptionText, isDark && styles.pickerOptionTextDark]}>
                        {vehicle.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#151718',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
  },
  titleDark: {
    color: '#ECEDEE',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  subtitleDark: {
    color: '#9BA1A6',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    minWidth: '30%',
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  statCardTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statCardTitleDark: {
    color: '#9BA1A6',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#11181C',
  },
  statCardValueDark: {
    color: '#ECEDEE',
  },
  statCardValueGreen: {
    color: '#10b981',
  },
  statCardValueGreenDark: {
    color: '#10b981',
  },
  statCardValueBlue: {
    color: '#3b82f6',
  },
  statCardValueBlueDark: {
    color: '#60a5fa',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 16,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
  },
  cardTitleDark: {
    color: '#ECEDEE',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
  },
  cardDescriptionDark: {
    color: '#9BA1A6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 200,
    maxWidth: 300,
  },
  searchContainerDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#11181C',
  },
  searchInputDark: {
    color: '#ECEDEE',
    backgroundColor: '#374151',
  },
  loader: {
    marginVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
    color: '#11181C',
  },
  emptyStateTitleDark: {
    color: '#ECEDEE',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyStateTextDark: {
    color: '#9BA1A6',
  },
  expenseCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  expenseCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  expenseCardSeparator: {
    height: 0,
  },
  expenseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseCardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  expenseCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 4,
  },
  expenseCardTitleDark: {
    color: '#ECEDEE',
  },
  expenseCardDate: {
    fontSize: 12,
    color: '#666',
  },
  expenseCardDateDark: {
    color: '#9BA1A6',
  },
  expenseCardAmount: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#ef4444',
  },
  expenseCardBody: {
    gap: 8,
  },
  expenseCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  expenseCardVendor: {
    fontSize: 14,
    color: '#666',
  },
  expenseCardVendorDark: {
    color: '#9BA1A6',
  },
  expenseCardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  expenseCardDescriptionDark: {
    color: '#9BA1A6',
  },
  expenseCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  expenseCardFooterDark: {
    borderTopColor: '#374151',
  },
  expenseCardStats: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
  },
  expenseCardStat: {
    gap: 4,
  },
  expenseCardStatLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expenseCardStatLabelDark: {
    color: '#9BA1A6',
  },
  expenseCardStatValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#11181C',
  },
  expenseCardStatValueDark: {
    color: '#ECEDEE',
  },
  expenseCardStatValueBlue: {
    color: '#3b82f6',
  },
  expenseCardStatValueBlueDark: {
    color: '#60a5fa',
  },
  expenseCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  expenseActionButton: {
    padding: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  badgeDark: {
    backgroundColor: '#4b5563',
    borderColor: '#6b7280',
  },
  badgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  badgeTextDark: {
    color: '#9BA1A6',
  },
  actionButton: {
    padding: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContainerDark: {
    backgroundColor: '#151718',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#11181C',
  },
  modalTitleDark: {
    color: '#ECEDEE',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  costBreakdownSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  costBreakdownSectionDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    color: '#11181C',
  },
  sectionLabelDark: {
    color: '#ECEDEE',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#11181C',
  },
  labelDark: {
    color: '#ECEDEE',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  helperTextDark: {
    color: '#9BA1A6',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#11181C',
    backgroundColor: '#fff',
  },
  inputDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
    color: '#ECEDEE',
  },
  inputBold: {
    fontWeight: '600',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  currencySymbol: {
    paddingLeft: 12,
    fontSize: 16,
    color: '#666',
  },
  currencySymbolDark: {
    color: '#9BA1A6',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  pickerButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#11181C',
  },
  pickerButtonTextDark: {
    color: '#ECEDEE',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#0a7ea4',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '80%',
    maxHeight: '60%',
  },
  pickerModalDark: {
    backgroundColor: '#1f2937',
  },
  pickerOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#11181C',
  },
  pickerOptionTextDark: {
    color: '#ECEDEE',
  },
});

