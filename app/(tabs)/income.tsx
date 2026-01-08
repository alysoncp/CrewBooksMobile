import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiRequest, uploadReceiptImage } from '@/lib/api';
import { formatCurrency, formatDate, getIncomeTypeLabel, getTodayLocalDateString, getYearFromDateString } from '@/lib/format';
import { type Income } from '@/lib/types';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INCOME_TYPES = ['union_production', 'non_union_production', 'royalty_residual', 'cash'] as const;

const ACCOUNTING_OFFICES = [
  { value: 'entertainment_partners_canada', label: 'Entertainment Partners Canada' },
  { value: 'cast_and_crew_services', label: 'Cast and Crew Services' },
  { value: 'other', label: 'Other' },
] as const;

interface IncomeFormData {
  amount: string;
  date: string;
  incomeType: string;
  productionName: string;
  accountingOffice: string;
  gstHstCollected: string;
  dues: string;
  retirement: string;
  labour: string;
  buyout: string;
  pension: string;
  insurance: string;
}

export default function Income() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { taxYear } = useTaxYear();
  const hasGstNumber = user?.hasGstNumber === true;

  const [incomeList, setIncomeList] = useState<Income[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customAccountingOffice, setCustomAccountingOffice] = useState('');
  const [showIncomeTypePicker, setShowIncomeTypePicker] = useState(false);
  const [showAccountingOfficePicker, setShowAccountingOfficePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);

  const [formData, setFormData] = useState<IncomeFormData>({
    amount: '',
    date: getTodayLocalDateString(),
    incomeType: '',
    productionName: '',
    accountingOffice: '',
    gstHstCollected: '',
    dues: '',
    retirement: '',
    labour: '',
    buyout: '',
    pension: '',
    insurance: '',
  });

  useEffect(() => {
    fetchIncome();
  }, []);

  const fetchIncome = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet<Income[]>('/api/income');
      setIncomeList(data);
    } catch (error) {
      console.error('Error fetching income:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredIncome = useMemo(() => {
    return (incomeList || []).filter((item) => {
      const itemYear = getYearFromDateString(item.date);
      if (itemYear !== taxYear) return false;

      const searchLower = searchQuery.toLowerCase();
      return (
        item.productionName?.toLowerCase().includes(searchLower) ||
        item.accountingOffice?.toLowerCase().includes(searchLower) ||
        getIncomeTypeLabel(item.incomeType).toLowerCase().includes(searchLower)
      );
    });
  }, [incomeList, taxYear, searchQuery]);

  const totalIncome = filteredIncome.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  
  const totalDeductions = filteredIncome.reduce((sum, item) => {
    const dues = item.dues ? parseFloat(item.dues.toString()) : 0;
    const retirement = item.retirement ? parseFloat(item.retirement.toString()) : 0;
    const labour = item.labour ? parseFloat(item.labour.toString()) : 0;
    const buyout = item.buyout ? parseFloat(item.buyout.toString()) : 0;
    const pension = item.pension ? parseFloat(item.pension.toString()) : 0;
    const insurance = item.insurance ? parseFloat(item.insurance.toString()) : 0;
    return sum + dues + retirement + labour + buyout + pension + insurance;
  }, 0);
  
  const totalGstHstCollected = filteredIncome.reduce((sum, item) => {
    return sum + (item.gstHstCollected ? parseFloat(item.gstHstCollected.toString()) : 0);
  }, 0);

  const handleSubmit = async () => {
    // Validation
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!formData.date) {
      Alert.alert('Error', 'Please enter a date');
      return;
    }
    if (!formData.incomeType) {
      Alert.alert('Error', 'Please select an income type');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        amount: formData.amount,
        date: formData.date,
        incomeType: formData.incomeType,
        productionName: formData.productionName || null,
        accountingOffice: formData.accountingOffice === 'other' && customAccountingOffice.trim()
          ? customAccountingOffice.trim()
          : formData.accountingOffice || null,
        gstHstCollected: formData.gstHstCollected ? parseFloat(formData.gstHstCollected) : null,
        dues: formData.dues ? parseFloat(formData.dues) : null,
        retirement: formData.retirement ? parseFloat(formData.retirement) : null,
        labour: formData.labour ? parseFloat(formData.labour) : null,
        buyout: formData.buyout ? parseFloat(formData.buyout) : null,
        pension: formData.pension ? parseFloat(formData.pension) : null,
        insurance: formData.insurance ? parseFloat(formData.insurance) : null,
      };

      if (editingIncome) {
        await apiRequest('PATCH', `/api/income/${editingIncome.id}`, payload);
        Alert.alert('Success', 'Income updated successfully');
      } else {
        await apiRequest('POST', '/api/income', payload);
        Alert.alert('Success', 'Income added successfully');
      }

      setIsModalOpen(false);
      setEditingIncome(null);
      resetFormData();
      await fetchIncome();
    } catch (error) {
      console.error('Error adding income:', error);
      Alert.alert('Error', 'Failed to add income. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete income entry?',
      'This will permanently remove this income record. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteId(id);
              await apiRequest('DELETE', `/api/income/${id}`);
              await fetchIncome();
              Alert.alert('Success', 'Income deleted successfully');
            } catch (error) {
              console.error('Error deleting income:', error);
              Alert.alert('Error', 'Failed to delete income. Please try again.');
            } finally {
              setDeleteId(null);
            }
          },
        },
      ]
    );
  };

  const resetFormData = () => {
    setFormData({
      amount: '',
      date: getTodayLocalDateString(),
      incomeType: '',
      productionName: '',
      accountingOffice: '',
      gstHstCollected: '',
      dues: '',
      retirement: '',
      labour: '',
      buyout: '',
      pension: '',
      insurance: '',
    });
    setCustomAccountingOffice('');
    setEditingIncome(null);
  };

  const openIncomeForm = () => {
    resetFormData();
    setIsModalOpen(true);
  };

  const handleEdit = (income: Income) => {
    setEditingIncome(income);
    setFormData({
      amount: parseFloat(income.amount.toString()).toFixed(2),
      date: income.date,
      incomeType: income.incomeType,
      productionName: income.productionName || '',
      accountingOffice: income.accountingOffice || '',
      gstHstCollected: income.gstHstCollected ? parseFloat(income.gstHstCollected.toString()).toFixed(2) : '',
      dues: income.dues ? parseFloat(income.dues.toString()).toFixed(2) : '',
      retirement: income.retirement ? parseFloat(income.retirement.toString()).toFixed(2) : '',
      labour: income.labour ? parseFloat(income.labour.toString()).toFixed(2) : '',
      buyout: income.buyout ? parseFloat(income.buyout.toString()).toFixed(2) : '',
      pension: income.pension ? parseFloat(income.pension.toString()).toFixed(2) : '',
      insurance: income.insurance ? parseFloat(income.insurance.toString()).toFixed(2) : '',
    });
    if (income.accountingOffice && !ACCOUNTING_OFFICES.find((o) => o.value === income.accountingOffice)) {
      setCustomAccountingOffice(income.accountingOffice);
      setFormData((prev) => ({ ...prev, accountingOffice: 'other' }));
    } else {
      setCustomAccountingOffice('');
    }
    setIsModalOpen(true);
  };

  const processReceiptImage = async (uri: string) => {
    try {
      setIsProcessingReceipt(true);
      const receiptData = await uploadReceiptImage(uri);
      
      // Check if OCR completed successfully
      if (receiptData.ocrStatus === 'completed' && receiptData.expenseData) {
        // Backend provides expenseData when OCR is successful
        // For income, we'll try to extract relevant fields
        const expenseData = receiptData.expenseData;
        
        const amount = expenseData.total || expenseData.amount || 0;
        const date = expenseData.date || getTodayLocalDateString();
        const productionName = expenseData.vendor || expenseData.merchantName || expenseData.description || '';
        
        setFormData({
          amount: parseFloat(amount.toString()).toFixed(2),
          date: date,
          incomeType: '', // User will need to select this
          productionName: productionName,
          accountingOffice: '',
          gstHstCollected: expenseData.gstAmount ? parseFloat(expenseData.gstAmount.toString()).toFixed(2) : '',
          dues: '',
          retirement: '',
          labour: '',
          buyout: '',
          pension: '',
          insurance: '',
        });
        setIsModalOpen(true);
      } else if (receiptData.ocrStatus === 'processing') {
        Alert.alert(
          'OCR Processing',
          'Receipt uploaded but OCR is still processing. Please check back later.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'OCR Not Available',
          receiptData.ocrError || 'Could not extract data from receipt. Please use manual entry.',
          [
            { text: 'Manual Entry', onPress: openIncomeForm },
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
            { text: 'Try Manual Entry', onPress: openIncomeForm },
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
      'Add Income',
      'Choose how you want to add income',
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
          onPress: openIncomeForm,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const renderIncomeItem = ({ item }: { item: Income }) => (
    <View style={[styles.incomeCard, isDark && styles.incomeCardDark]}>
      <View style={styles.incomeCardHeader}>
        <View style={styles.incomeCardHeaderLeft}>
          <Text style={[styles.incomeCardTitle, isDark && styles.incomeCardTitleDark]}>
            {item.productionName || 'Untitled Income'}
          </Text>
          <Text style={[styles.incomeCardDate, isDark && styles.incomeCardDateDark]}>
            {formatDate(item.date)}
          </Text>
        </View>
        <Text style={styles.incomeCardAmount}>{formatCurrency(item.amount)}</Text>
      </View>
      
      <View style={styles.incomeCardBody}>
        <View style={styles.incomeCardRow}>
          <View style={[styles.badge, isDark && styles.badgeDark]}>
            <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
              {getIncomeTypeLabel(item.incomeType)}
            </Text>
          </View>
          {item.accountingOffice && (
            <Text style={[styles.incomeCardOffice, isDark && styles.incomeCardOfficeDark]}>
              {item.accountingOffice}
            </Text>
          )}
        </View>
      </View>
      
      <View style={[styles.incomeCardFooter, isDark && styles.incomeCardFooterDark]}>
        <View style={styles.incomeCardActions}>
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={styles.incomeActionButton}
          >
            <MaterialIcons name="edit" size={20} color={isDark ? '#9BA1A6' : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            disabled={deleteId === item.id}
            style={styles.incomeActionButton}
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
  );

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]} contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Income</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            Track your earnings from productions and gigs
          </Text>
        </View>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={handleAddPress}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, isDark && styles.statCardDark]}>
          <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>Total Income</Text>
          <Text style={[styles.statCardValue, isDark && styles.statCardValueDark]}>
            {formatCurrency(totalIncome)}
          </Text>
        </View>
        <View style={[styles.statCard, isDark && styles.statCardDark]}>
          <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>Total Deductions</Text>
          <Text style={[styles.statCardValue, styles.statCardValueGreen, isDark && styles.statCardValueGreenDark]}>
            {formatCurrency(totalDeductions)}
          </Text>
        </View>
        {hasGstNumber && totalGstHstCollected > 0 && (
          <View style={[styles.statCard, isDark && styles.statCardDark]}>
            <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>GST/HST Collected</Text>
            <Text style={[styles.statCardValue, styles.statCardValueBlue, isDark && styles.statCardValueBlueDark]}>
              {formatCurrency(totalGstHstCollected)}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Income History</Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              All recorded income for {taxYear}
            </Text>
          </View>
          <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
            <MaterialIcons name="search" size={18} color={isDark ? '#9BA1A6' : '#666'} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, isDark && styles.searchInputDark]}
              placeholder="Search income..."
              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} style={styles.loader} />
        ) : filteredIncome.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="description" size={48} color={isDark ? '#9BA1A6' : '#666'} />
            <Text style={[styles.emptyStateTitle, isDark && styles.emptyStateTitleDark]}>
              No income recorded
            </Text>
            <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>
              {searchQuery ? 'No results match your search' : 'Add your first income entry to get started'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredIncome}
            renderItem={renderIncomeItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.incomeCardSeparator} />}
          />
        )}
      </View>

      {/* Add Income Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={[styles.modalContainer, isDark && styles.modalContainerDark]}>
          <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              {editingIncome ? 'Edit Income' : 'Add Income'}
            </Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Net Pay *</Text>
              <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, styles.inputInCurrency, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.amount}
                  onChangeText={(text) => setFormData({ ...formData, amount: text })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Period Ending *</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.date}
                onChangeText={(text) => setFormData({ ...formData, date: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Income Type *</Text>
              <TouchableOpacity
                style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
                onPress={() => setShowIncomeTypePicker(true)}
              >
                <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
                  {formData.incomeType ? getIncomeTypeLabel(formData.incomeType) : 'Select type'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Show</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="e.g., The Crown Season 6"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.productionName}
                onChangeText={(text) => setFormData({ ...formData, productionName: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Issuer</Text>
              <TouchableOpacity
                style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
                onPress={() => setShowAccountingOfficePicker(true)}
              >
                <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
                  {formData.accountingOffice
                    ? ACCOUNTING_OFFICES.find((o) => o.value === formData.accountingOffice)?.label || 'Other'
                    : 'Select issuer'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
              </TouchableOpacity>
            </View>

            {formData.accountingOffice === 'other' && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Custom Accounting Office</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="Enter accounting office name"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={customAccountingOffice}
                  onChangeText={setCustomAccountingOffice}
                />
              </View>
            )}

            {hasGstNumber && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>GST/HST Collected</Text>
                <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, styles.inputInCurrency, isDark && styles.inputDark]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={formData.gstHstCollected}
                    onChangeText={(text) => setFormData({ ...formData, gstHstCollected: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Dues</Text>
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.dues}
                  onChangeText={(text) => setFormData({ ...formData, dues: text })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Retirement</Text>
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.retirement}
                  onChangeText={(text) => setFormData({ ...formData, retirement: text })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Labour</Text>
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.labour}
                  onChangeText={(text) => setFormData({ ...formData, labour: text })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Buyout</Text>
              <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, styles.inputInCurrency, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.buyout}
                  onChangeText={(text) => setFormData({ ...formData, buyout: text })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Pension</Text>
              <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, styles.inputInCurrency, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.pension}
                  onChangeText={(text) => setFormData({ ...formData, pension: text })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Insurance</Text>
              <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, styles.inputInCurrency, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.insurance}
                  onChangeText={(text) => setFormData({ ...formData, insurance: text })}
                  keyboardType="decimal-pad"
                />
              </View>
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
                  {editingIncome ? 'Update Income' : 'Save Income'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Income Type Picker Modal */}
        <Modal
          visible={showIncomeTypePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowIncomeTypePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowIncomeTypePicker(false)}
          >
            <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
              {INCOME_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.pickerOption}
                  onPress={() => {
                    setFormData({ ...formData, incomeType: type });
                    setShowIncomeTypePicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, isDark && styles.pickerOptionTextDark]}>
                    {getIncomeTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Accounting Office Picker Modal */}
        <Modal
          visible={showAccountingOfficePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAccountingOfficePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowAccountingOfficePicker(false)}
          >
            <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
              {ACCOUNTING_OFFICES.map((office) => (
                <TouchableOpacity
                  key={office.value}
                  style={styles.pickerOption}
                  onPress={() => {
                    setFormData({ ...formData, accountingOffice: office.value });
                    if (office.value !== 'other') {
                      setCustomAccountingOffice('');
                    }
                    setShowAccountingOfficePicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, isDark && styles.pickerOptionTextDark]}>
                    {office.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
    marginBottom: 16,
  },
  subtitleDark: {
    color: '#9BA1A6',
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
    backgroundColor: 'transparent',
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
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tableHeaderDark: {
    backgroundColor: '#374151',
    borderBottomColor: '#4b5563',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderTextDark: {
    color: '#9BA1A6',
  },
  tableHeaderTextDate: {
    width: '20%',
  },
  tableHeaderTextType: {
    width: '20%',
  },
  tableHeaderTextProduction: {
    flex: 1,
  },
  tableHeaderTextAmount: {
    width: '25%',
    textAlign: 'right',
  },
  tableHeaderTextAction: {
    width: 40,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  tableRowDark: {
    borderBottomColor: '#4b5563',
  },
  tableCell: {
    paddingRight: 8,
  },
  tableCellText: {
    fontSize: 14,
    color: '#666',
  },
  tableCellTextDark: {
    color: '#9BA1A6',
  },
  tableCellTextBold: {
    fontWeight: '500',
    color: '#11181C',
  },
  tableCellProduction: {
    flex: 1,
  },
  tableCellAmount: {
    width: '25%',
    alignItems: 'flex-end',
  },
  tableCellAction: {
    width: 40,
    alignItems: 'center',
  },
  tableCellAmountText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
    color: '#10b981',
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
  incomeCard: {
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
  incomeCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  incomeCardSeparator: {
    height: 0,
  },
  incomeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  incomeCardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  incomeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 4,
  },
  incomeCardTitleDark: {
    color: '#ECEDEE',
  },
  incomeCardDate: {
    fontSize: 12,
    color: '#666',
  },
  incomeCardDateDark: {
    color: '#9BA1A6',
  },
  incomeCardAmount: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#10b981',
  },
  incomeCardBody: {
    gap: 8,
  },
  incomeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  incomeCardOffice: {
    fontSize: 14,
    color: '#666',
  },
  incomeCardOfficeDark: {
    color: '#9BA1A6',
  },
  incomeCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  incomeCardFooterDark: {
    borderTopColor: '#374151',
  },
  incomeCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  incomeActionButton: {
    padding: 8,
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
