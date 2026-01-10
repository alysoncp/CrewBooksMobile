import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiRequest, uploadReceiptImage } from '@/lib/api';
import { formatCurrency, formatDate, getCategoryLabel, getTodayLocalDateString, getYearFromDateString } from '@/lib/format';
import { type Expense, type Vehicle, HOME_OFFICE_LIVING_CATEGORIES } from '@/lib/types';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Module-level cache to persist across component remounts
let receiptsCache: any[] | null = null;
let receiptsCacheTimestamp: number = 0;
let receiptsFetching: boolean = false;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
  const router = useRouter();
  const { user } = useAuth();
  const { taxYear, setTaxYear } = useTaxYear();
  const hasGstNumber = user?.hasGstNumber === true;

  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [receipts, setReceipts] = useState<any[]>(receiptsCache || []);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lastEditedField, setLastEditedField] = useState<'baseCost' | 'total' | 'gstAmount' | 'pstAmount' | null>(null);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilterCategoryPicker, setShowFilterCategoryPicker] = useState(false);
  const [vehicleBusinessUseMap, setVehicleBusinessUseMap] = useState<Map<string, number>>(new Map());

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

  const fetchReceipts = useCallback(async () => {
    // Prevent concurrent fetches
    if (receiptsFetching) {
      if (__DEV__) {
        console.log('Receipt fetch already in progress, skipping');
      }
      return;
    }
    
    // Use cache if it's still valid (less than 5 minutes old)
    const now = Date.now();
    if (receiptsCache && receiptsCacheTimestamp > 0 && (now - receiptsCacheTimestamp) < CACHE_DURATION) {
      if (__DEV__) {
        console.log('Using cached receipts');
      }
      setReceipts(receiptsCache);
      return;
    }
    
    receiptsFetching = true;
    if (__DEV__) {
      console.log('Fetching receipts...');
    }
    
    try {
      const data = await apiGet<any[]>('/api/receipts');
      receiptsCache = data || [];
      receiptsCacheTimestamp = now;
      
      if (__DEV__) {
        console.log('Fetched receipts:', data);
        if (data && data.length > 0) {
          console.log('Sample receipt:', data[0]);
        }
      }
      setReceipts(receiptsCache);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      setReceipts([]);
    } finally {
      receiptsFetching = false;
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    fetchVehicles();
  }, []);

  // Fetch receipts only once when component mounts
  useEffect(() => {
    // Only fetch if we don't have cached data
    if (!receiptsCache || receiptsCache.length === 0) {
      fetchReceipts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
          item.title?.toLowerCase().includes(searchLower) ||
          item.vendor?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          getCategoryLabel(item.category).toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory && item.category !== selectedCategory) {
        return false;
      }

      // Vendor filter
      if (selectedVendor) {
        const vendorLower = selectedVendor.toLowerCase();
        if (!item.vendor?.toLowerCase().includes(vendorLower)) {
          return false;
        }
      }

      // Amount filters
      const itemAmount = parseFloat(item.amount.toString());
      if (minAmount) {
        const min = parseFloat(minAmount);
        if (isNaN(min) || itemAmount < min) return false;
      }
      if (maxAmount) {
        const max = parseFloat(maxAmount);
        if (isNaN(max) || itemAmount > max) return false;
      }

      // Date range filters
      if (dateFrom && item.date < dateFrom) return false;
      if (dateTo && item.date > dateTo) return false;

      return true;
    });
  }, [expenseList, taxYear, searchQuery, selectedCategory, selectedVendor, minAmount, maxAmount, dateFrom, dateTo]);

  // Helper function to calculate deductible amount and deductible GST for an expense
  const calculateDeductible = useCallback((item: Expense, vehicleBusinessUseMap: Map<string, number>) => {
    if (!item.isTaxDeductible) {
      return { deductibleAmount: 0, deductibleGst: 0 };
    }

    const expenseType = (item as any).expenseType || 'self_employment';
    const baseCost = item.baseCost ? parseFloat(item.baseCost.toString()) : 0;
    const pstAmount = item.pstAmount ? parseFloat(item.pstAmount.toString()) : 0;
    const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;

    if (expenseType === 'personal') {
      return { deductibleAmount: 0, deductibleGst: 0 };
    }

    if (expenseType === 'home_office_living') {
      // Home Office/Living expenses: apply home office percentage if set
      let deductibleAmount = baseCost + pstAmount;
      let deductibleGst = gstAmount;
      if (user?.homeOfficePercentage) {
        const percentage = parseFloat(user.homeOfficePercentage.toString()) / 100;
        deductibleAmount = deductibleAmount * percentage;
        deductibleGst = deductibleGst * percentage;
      }
      return { deductibleAmount, deductibleGst };
    }

    if (expenseType === 'vehicle') {
      // Vehicle expenses: use business use percentage from odometer entries
      const vehicleId = (item as any).vehicleId;
      let businessPercentage = 1.0; // Default to 100% if no vehicle or percentage found
      
      if (vehicleId && vehicleBusinessUseMap.has(vehicleId)) {
        businessPercentage = vehicleBusinessUseMap.get(vehicleId)! / 100;
      }
      
      const deductibleAmount = (baseCost + pstAmount) * businessPercentage;
      const deductibleGst = gstAmount * businessPercentage;
      return { deductibleAmount, deductibleGst };
    }

    if (expenseType === 'self_employment') {
      // Self-Employment expenses: fully deductible
      return { deductibleAmount: baseCost + pstAmount, deductibleGst: gstAmount };
    }

    if (expenseType === 'mixed') {
      const businessPercentage = (item as any).businessUsePercentage 
        ? parseFloat((item as any).businessUsePercentage.toString()) / 100 
        : 0;
      
      // Only business portion of base cost + proportional PST is deductible
      const businessBaseCost = baseCost * businessPercentage;
      const businessPstAmount = pstAmount * businessPercentage;
      let deductibleAmount = businessBaseCost + businessPstAmount;
      let deductibleGst = gstAmount * businessPercentage;
      
      // Apply home office percentage if applicable for home office/living categories
      if (HOME_OFFICE_LIVING_CATEGORIES.includes(item.category as any) && user?.homeOfficePercentage) {
        const homeOfficePercentage = parseFloat(user.homeOfficePercentage.toString()) / 100;
        deductibleAmount = deductibleAmount * homeOfficePercentage;
        deductibleGst = deductibleGst * homeOfficePercentage;
      }
      
      return { deductibleAmount, deductibleGst };
    }

    // Default: treat as business expense (fully deductible)
    return { deductibleAmount: baseCost + pstAmount, deductibleGst: gstAmount };
  }, [user]);

  // Get unique vehicle IDs from vehicle expenses
  const vehicleIdsInExpenses = useMemo(() => {
    const ids = new Set<string>();
    if (!filteredExpenses) return [];
    
    filteredExpenses.forEach((expense) => {
      const expenseType = (expense as any).expenseType || 'self_employment';
      if (expenseType === 'vehicle' && (expense as any).vehicleId) {
        const vehicleId = (expense as any).vehicleId;
        if (vehicleId) {
          ids.add(vehicleId);
        }
      }
    });
    
    return Array.from(ids);
  }, [filteredExpenses]);

  // Fetch business use percentages for vehicles used in expenses
  useEffect(() => {
    const fetchVehiclePercentages = async () => {
      const map = new Map<string, number>();
      const promises = vehicleIdsInExpenses.map(async (vehicleId: string) => {
        try {
          const response = await apiGet<{ businessUsePercentage: number }>(`/api/vehicles/${vehicleId}/business-use-percentage?taxYear=${taxYear}`);
          map.set(vehicleId, response.businessUsePercentage || 100);
        } catch (error) {
          map.set(vehicleId, 100); // Default to 100% if fetch fails
        }
      });
      
      await Promise.all(promises);
      setVehicleBusinessUseMap(map);
    };
    
    if (vehicleIdsInExpenses.length > 0) {
      fetchVehiclePercentages();
    } else {
      setVehicleBusinessUseMap(new Map());
    }
  }, [vehicleIdsInExpenses, taxYear]);

  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  
  // Calculate deductible expenses and deductible GST using the helper function
  const { deductibleExpenses, deductibleGstCredits } = useMemo(() => {
    let deductibleSum = 0;
    let deductibleGstSum = 0;
    
    // Create a temporary map with default 100% for vehicles (for summary calculations)
    const tempVehicleMap = new Map<string, number>();
    vehicles.forEach(vehicle => {
      if (vehicle.id) {
        // For summary, use 100% as default - actual calculation happens in table rows
        tempVehicleMap.set(vehicle.id, 100);
      }
    });
    
    filteredExpenses.forEach((item) => {
      const result = calculateDeductible(item, tempVehicleMap);
      deductibleSum += result.deductibleAmount;
      deductibleGstSum += result.deductibleGst;
    });
    
    return { deductibleExpenses: deductibleSum, deductibleGstCredits: deductibleGstSum };
  }, [filteredExpenses, calculateDeductible, vehicles]);
  
  const totalGstCredits = filteredExpenses.reduce((sum, item) => {
    const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;
    return sum + gstAmount;
  }, 0);

  // Filter categories based on user's enabled categories
  const enabledCategories = useMemo(() => {
    if (!user?.enabledExpenseCategories || user.enabledExpenseCategories.length === 0) {
      // If no enabled categories are set, show all categories
      return EXPENSE_CATEGORIES;
    }
    return EXPENSE_CATEGORIES.filter((category) => 
      user.enabledExpenseCategories?.includes(category)
    );
  }, [user?.enabledExpenseCategories]);

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

  const renderExpenseItem = useCallback(({ item }: { item: Expense }) => {
    // Calculate deductible amount and deductible GST using the helper function
    const { deductibleAmount, deductibleGst } = calculateDeductible(item, vehicleBusinessUseMap);
    const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;
    
    // Check if there's a linked receipt
    const hasLinkedReceipt = receipts.some((receipt) => receipt.linkedExpenseId === item.id);

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
          <View style={styles.expenseCardActions}>
            {hasLinkedReceipt && (() => {
              const linkedReceipt = receipts.find((r) => r.linkedExpenseId === item.id);
              return (
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/receipt-gallery',
                    params: { receiptId: linkedReceipt?.id }
                  })}
                  style={styles.expenseActionButton}
                >
                  <MaterialIcons name="receipt" size={20} color={isDark ? '#9BA1A6' : '#666'} />
                </TouchableOpacity>
              );
            })()}
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
              {deductibleGst > 0 && (
                <View style={styles.expenseCardStat}>
                  <Text style={[styles.expenseCardStatLabel, isDark && styles.expenseCardStatLabelDark]}>Deductible GST</Text>
                  <Text style={[styles.expenseCardStatValue, styles.expenseCardStatValueBlue, isDark && styles.expenseCardStatValueBlueDark]}>
                    {formatCurrency(deductibleGst)}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.expenseCardStat, styles.expenseCardStatRight]}>
              <Text style={[styles.expenseCardStatLabel, isDark && styles.expenseCardStatLabelDark]}>Total</Text>
              <Text style={[styles.expenseCardStatValue, styles.expenseCardStatValueRed, isDark && styles.expenseCardStatValueRedDark]}>
                -{formatCurrency(item.amount)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }, [receipts, isDark, router, handleEdit, handleDelete, deleteId, calculateDeductible, vehicleBusinessUseMap]);

  const resetFormData = () => {
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
  };

  const openExpenseForm = () => {
    resetFormData();
    setIsModalOpen(true);
  };

  const processReceiptImage = async (uri: string) => {
    try {
      setIsProcessingReceipt(true);
      const receiptData = await uploadReceiptImage(uri);
      
      // Check if OCR completed successfully
      if (receiptData.ocrStatus === 'completed' && receiptData.expenseData) {
        // Backend provides expenseData when OCR is successful
        const expenseData = receiptData.expenseData;
        
        const total = expenseData.total || expenseData.amount || 0;
        const date = expenseData.date || getTodayLocalDateString();
        const vendor = expenseData.vendor || expenseData.merchantName || '';
        const category = expenseData.category || '';
        const description = expenseData.description || expenseData.notes || '';
        const baseCost = expenseData.baseCost || expenseData.subtotal || (total - (expenseData.gstAmount || 0) - (expenseData.pstAmount || 0));
        const gstAmount = expenseData.gstAmount || 0;
        const pstAmount = expenseData.pstAmount || 0;

        setFormData({
          baseCost: baseCost ? parseFloat(baseCost.toString()).toFixed(2) : total.toFixed(2),
          total: parseFloat(total.toString()).toFixed(2),
          gstAmount: gstAmount ? parseFloat(gstAmount.toString()).toFixed(2) : '',
          pstAmount: pstAmount ? parseFloat(pstAmount.toString()).toFixed(2) : '',
          gstIncluded: !!gstAmount,
          pstIncluded: !!pstAmount,
          date: date,
          title: vendor || description || 'Receipt',
          category: category || '',
          subcategory: expenseData.subcategory || '',
          vehicleId: expenseData.vehicleId || '',
          vendor: vendor,
          description: description,
          isTaxDeductible: expenseData.isTaxDeductible !== undefined ? expenseData.isTaxDeductible : true,
        });
        setLastEditedField('total');
        setIsModalOpen(true);
      } else if (receiptData.ocrStatus === 'processing') {
        // OCR is still processing (shouldn't happen with sync processing, but handle it)
        Alert.alert(
          'OCR Processing',
          'Receipt uploaded but OCR is still processing. Please check back later.',
          [{ text: 'OK' }]
        );
      } else {
        // OCR failed or not available
        Alert.alert(
          'OCR Not Available',
          receiptData.ocrError || 'Could not extract data from receipt. Please use manual entry.',
          [
            { text: 'Manual Entry', onPress: openExpenseForm },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
      setIsProcessingReceipt(false);
    } catch (error: any) {
      console.error('Error processing receipt:', error);
      setIsProcessingReceipt(false);
      
      // Check for subscription tier error
      if (error.message?.includes('403') || error.message?.includes('subscription')) {
        Alert.alert(
          'Subscription Required',
          'Receipt uploads require a Personal or Corporate subscription. Please upgrade your plan.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error Processing Receipt',
          error.message || 'Failed to process receipt. Please try again or use manual entry.',
          [
            { text: 'Try Manual Entry', onPress: openExpenseForm },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Photo library permission is required to select photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleAddPress = () => {
    Alert.alert(
      'Add Expense',
      'Choose how you want to add an expense',
      [
        {
          text: 'Take Photo',
          onPress: handleTakePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: handlePickImage,
        },
        {
          text: 'Manual Entry',
          onPress: openExpenseForm,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 80 }]}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, isDark && styles.titleDark]}>Expenses</Text>
            </View>
            <TouchableOpacity
              style={[styles.taxYearPicker, isDark && styles.taxYearPickerDark]}
              onPress={() => setShowYearPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.taxYearValue, isDark && styles.taxYearValueDark]}>
                {taxYear}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color={isDark ? '#9BA1A6' : '#666'} />
            </TouchableOpacity>
          </View>
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
          <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>Deductible GST Credits</Text>
          <Text style={[styles.statCardValue, styles.statCardValueBlue, isDark && styles.statCardValueBlueDark]}>
            {formatCurrency(deductibleGstCredits)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.receiptGalleryCard, isDark && styles.receiptGalleryCardDark]}
        onPress={() => router.push('/receipt-gallery')}
        activeOpacity={0.7}
      >
        <View style={styles.receiptGalleryCardContent}>
          <View style={[styles.receiptGalleryIcon, isDark && styles.receiptGalleryIconDark]}>
            <MaterialIcons name="photo-library" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
          </View>
          <View style={styles.receiptGalleryText}>
            <Text style={[styles.receiptGalleryTitle, isDark && styles.receiptGalleryTitleDark]}>
              Receipt Gallery
            </Text>
            <Text style={[styles.receiptGalleryDescription, isDark && styles.receiptGalleryDescriptionDark]}>
              View and manage your receipt images
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={isDark ? '#9BA1A6' : '#666'} />
        </View>
      </TouchableOpacity>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Expense History</Text>
          </View>
          <View style={styles.headerControls}>
            <TouchableOpacity
              style={[styles.filterButton, isDark && styles.filterButtonDark, (selectedCategory || selectedVendor || minAmount || maxAmount || dateFrom || dateTo) && styles.filterButtonActive]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <MaterialIcons name="filter-list" size={20} color={(selectedCategory || selectedVendor || minAmount || maxAmount || dateFrom || dateTo) ? '#fff' : (isDark ? '#9BA1A6' : '#666')} />
            </TouchableOpacity>
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
        </View>
        
        {/* Active Filter Chips */}
        {(selectedCategory || selectedVendor || minAmount || maxAmount || dateFrom || dateTo) && (
          <View style={styles.filterChipsContainer}>
            {selectedCategory && (
              <View style={[styles.filterChip, isDark && styles.filterChipDark]}>
                <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark]}>
                  {getCategoryLabel(selectedCategory)}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedCategory(null)}
                  style={styles.filterChipClose}
                >
                  <MaterialIcons name="close" size={16} color={isDark ? '#9BA1A6' : '#666'} />
                </TouchableOpacity>
              </View>
            )}
            {selectedVendor && (
              <View style={[styles.filterChip, isDark && styles.filterChipDark]}>
                <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark]}>
                  Vendor: {selectedVendor}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedVendor('')}
                  style={styles.filterChipClose}
                >
                  <MaterialIcons name="close" size={16} color={isDark ? '#9BA1A6' : '#666'} />
                </TouchableOpacity>
              </View>
            )}
            {(minAmount || maxAmount) && (
              <View style={[styles.filterChip, isDark && styles.filterChipDark]}>
                <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark]}>
                  {minAmount && maxAmount ? `$${minAmount} - $${maxAmount}` : minAmount ? `≥ $${minAmount}` : `≤ $${maxAmount}`}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setMinAmount('');
                    setMaxAmount('');
                  }}
                  style={styles.filterChipClose}
                >
                  <MaterialIcons name="close" size={16} color={isDark ? '#9BA1A6' : '#666'} />
                </TouchableOpacity>
              </View>
            )}
            {(dateFrom || dateTo) && (
              <View style={[styles.filterChip, isDark && styles.filterChipDark]}>
                <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark]}>
                  {dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom ? `From ${dateFrom}` : `To ${dateTo}`}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  style={styles.filterChipClose}
                >
                  <MaterialIcons name="close" size={16} color={isDark ? '#9BA1A6' : '#666'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <View style={[styles.filterPanel, isDark && styles.filterPanelDark]}>
            <View style={styles.filterPanelHeader}>
              <Text style={[styles.filterPanelTitle, isDark && styles.filterPanelTitleDark]}>Filters</Text>
              <TouchableOpacity onPress={() => {
                setSelectedCategory(null);
                setSelectedVendor('');
                setMinAmount('');
                setMaxAmount('');
                setDateFrom('');
                setDateTo('');
              }}>
                <Text style={[styles.filterClearAll, isDark && styles.filterClearAllDark]}>Clear All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, isDark && styles.filterLabelDark]}>Category</Text>
              <TouchableOpacity
                style={[styles.filterSelectButton, isDark && styles.filterSelectButtonDark]}
                onPress={() => setShowFilterCategoryPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterSelectText, isDark && styles.filterSelectTextDark]} pointerEvents="none">
                  {selectedCategory ? getCategoryLabel(selectedCategory) : 'All Categories'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={20} color={isDark ? '#9BA1A6' : '#666'} pointerEvents="none" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, isDark && styles.filterLabelDark]}>Vendor</Text>
              <TextInput
                style={[styles.filterInput, isDark && styles.filterInputDark]}
                placeholder="Filter by vendor..."
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={selectedVendor}
                onChangeText={setSelectedVendor}
              />
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, isDark && styles.filterLabelDark]}>Amount Range</Text>
              <View style={styles.filterRow}>
                <View style={[styles.currencyInput, styles.filterInputHalf, isDark && styles.currencyInputDark]}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.filterInputText, isDark && styles.filterInputTextDark]}
                    placeholder="Min"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={minAmount}
                    onChangeText={setMinAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.currencyInput, styles.filterInputHalf, isDark && styles.currencyInputDark]}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.filterInputText, isDark && styles.filterInputTextDark]}
                    placeholder="Max"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, isDark && styles.filterLabelDark]}>Date Range</Text>
              <View style={styles.filterRow}>
                <TextInput
                  style={[styles.filterInput, styles.filterInputHalf, isDark && styles.filterInputDark]}
                  placeholder="From (YYYY-MM-DD)"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={dateFrom}
                  onChangeText={setDateFrom}
                />
                <TextInput
                  style={[styles.filterInput, styles.filterInputHalf, isDark && styles.filterInputDark]}
                  placeholder="To (YYYY-MM-DD)"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={dateTo}
                  onChangeText={setDateTo}
                />
              </View>
            </View>
          </View>
        )}
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
          <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
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
                <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, styles.inputInCurrency, isDark && styles.inputDark]}
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
                <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, styles.inputInCurrency, isDark && styles.inputDark, !formData.gstIncluded && styles.inputDisabled]}
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
                <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, styles.inputInCurrency, isDark && styles.inputDark, !formData.pstIncluded && styles.inputDisabled]}
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
                <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, styles.inputInCurrency, styles.inputBold, isDark && styles.inputDark]}
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

          <View style={[styles.modalFooter, isDark && styles.modalFooterDark]}>
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
                {enabledCategories.map((category) => (
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
      <TouchableOpacity
        style={[styles.fabButton, { bottom: insets.bottom + 16, right: 24 }]}
        onPress={handleAddPress}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Filter Category Picker Modal */}
      <Modal
        visible={showFilterCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterCategoryPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterCategoryPicker(false)}
        >
          <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
              <ScrollView>
                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={() => {
                    setSelectedCategory(null);
                    setShowFilterCategoryPicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, isDark && styles.pickerOptionTextDark, !selectedCategory && styles.pickerOptionTextSelected]}>
                    All Categories
                  </Text>
                </TouchableOpacity>
                {enabledCategories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={styles.pickerOption}
                    onPress={() => {
                      setSelectedCategory(category);
                      setShowFilterCategoryPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, isDark && styles.pickerOptionTextDark, selectedCategory === category && styles.pickerOptionTextSelected]}>
                      {getCategoryLabel(category)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tax Year Picker Modal */}
      <Modal
        visible={showYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowYearPicker(false)}
        >
          <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
            <ScrollView>
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.pickerOption,
                    year === taxYear && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setTaxYear(year);
                    setShowYearPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      isDark && styles.pickerOptionTextDark,
                      year === taxYear && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {year}
                  </Text>
                  {year === taxYear && (
                    <MaterialIcons name="check" size={24} color={isDark ? '#0a7ea4' : '#0a7ea4'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    padding: 16,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 0,
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
  fabButton: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0a7ea4',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 1000,
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
    flexDirection: 'column',
    marginBottom: 16,
    gap: 12,
  },
  cardHeaderLeft: {
    width: '100%',
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
    flex: 1,
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
  expenseCardStatRight: {
    alignItems: 'flex-end',
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
  expenseCardStatValueRed: {
    color: '#ef4444',
  },
  expenseCardStatValueRedDark: {
    color: '#ef4444',
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modalHeaderDark: {
    backgroundColor: '#151718',
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#11181C',
    letterSpacing: -0.5,
  },
  modalTitleDark: {
    color: '#ECEDEE',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  costBreakdownSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  costBreakdownSectionDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 20,
    color: '#11181C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabelDark: {
    color: '#ECEDEE',
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelDark: {
    color: '#9BA1A6',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  helperTextDark: {
    color: '#9BA1A6',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#11181C',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
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
  inputInCurrency: {
    flex: 1,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingLeft: 4,
    paddingRight: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    minHeight: 20,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  currencyInputDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  currencySymbol: {
    paddingLeft: 16,
    paddingRight: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  currencySymbolDark: {
    color: '#9BA1A6',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  pickerButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#11181C',
    fontWeight: '500',
  },
  pickerButtonTextDark: {
    color: '#ECEDEE',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  modalFooterDark: {
    backgroundColor: '#151718',
    borderTopColor: '#374151',
  },
  submitButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerOptionSelected: {
    backgroundColor: '#f0f9ff',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#11181C',
  },
  pickerOptionTextDark: {
    color: '#ECEDEE',
  },
  taxYearPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    minWidth: 100,
  },
  taxYearPickerDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  taxYearValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
  },
  taxYearValueDark: {
    color: '#ECEDEE',
  },
  pickerOptionTextSelected: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  receiptGalleryCard: {
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
  receiptGalleryCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  receiptGalleryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiptGalleryIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptGalleryIconDark: {
    backgroundColor: '#374151',
  },
  receiptGalleryText: {
    flex: 1,
  },
  receiptGalleryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 2,
  },
  receiptGalleryTitleDark: {
    color: '#ECEDEE',
  },
  receiptGalleryDescription: {
    fontSize: 14,
    color: '#666',
  },
  receiptGalleryDescriptionDark: {
    color: '#9BA1A6',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  filterButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  filterButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    marginTop: -8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    gap: 6,
  },
  filterChipDark: {
    backgroundColor: '#374151',
  },
  filterChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  filterChipTextDark: {
    color: '#9BA1A6',
  },
  filterChipClose: {
    padding: 2,
  },
  filterPanel: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterPanelDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  filterPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterPanelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
  },
  filterPanelTitleDark: {
    color: '#ECEDEE',
  },
  filterClearAll: {
    fontSize: 14,
    color: '#0a7ea4',
    fontWeight: '500',
  },
  filterClearAllDark: {
    color: '#60a5fa',
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterLabelDark: {
    color: '#9BA1A6',
  },
  filterSelectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  filterSelectButtonDark: {
    backgroundColor: '#1f2937',
    borderColor: '#4b5563',
  },
  filterSelectText: {
    fontSize: 14,
    color: '#11181C',
    fontWeight: '500',
  },
  filterSelectTextDark: {
    color: '#ECEDEE',
  },
  filterInput: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#11181C',
    backgroundColor: '#fff',
  },
  filterInputDark: {
    backgroundColor: '#1f2937',
    borderColor: '#4b5563',
    color: '#ECEDEE',
  },
  filterInputHalf: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterInputText: {
    flex: 1,
    fontSize: 14,
    color: '#11181C',
    borderWidth: 0,
    paddingLeft: 4,
    paddingRight: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  filterInputTextDark: {
    color: '#ECEDEE',
  },
});

