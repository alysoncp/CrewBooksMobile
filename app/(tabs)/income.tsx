import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiRequest } from '@/lib/api';
import { formatCurrency, formatDate, getIncomeTypeLabel, getTodayLocalDateString, getYearFromDateString } from '@/lib/format';
import { MaterialIcons } from '@expo/vector-icons';
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

interface Income {
  id: string;
  amount: number | string;
  date: string;
  incomeType: string;
  productionName?: string;
  accountingOffice?: string;
  gstHstCollected?: number | string;
  dues?: number | string;
  retirement?: number | string;
  labour?: number | string;
  buyout?: number | string;
  pension?: number | string;
  insurance?: number | string;
  [key: string]: any;
}

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
  const hasGstNumber = user?.hasGstNumber === true;
  const taxYear = new Date().getFullYear();

  const [incomeList, setIncomeList] = useState<Income[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customAccountingOffice, setCustomAccountingOffice] = useState('');
  const [showIncomeTypePicker, setShowIncomeTypePicker] = useState(false);
  const [showAccountingOfficePicker, setShowAccountingOfficePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

      await apiRequest('POST', '/api/income', payload);
      await fetchIncome();
      setIsModalOpen(false);
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
      Alert.alert('Success', 'Income added successfully');
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

  const renderIncomeItem = ({ item }: { item: Income }) => (
    <View style={[styles.tableRow, isDark && styles.tableRowDark]}>
      <View style={styles.tableCell}>
        <Text style={[styles.tableCellText, isDark && styles.tableCellTextDark]}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.tableCell}>
        <View style={[styles.badge, isDark && styles.badgeDark]}>
          <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
            {getIncomeTypeLabel(item.incomeType)}
          </Text>
        </View>
      </View>
      <View style={[styles.tableCell, styles.tableCellProduction]}>
        <Text style={[styles.tableCellText, styles.tableCellTextBold, isDark && styles.tableCellTextDark]}>
          {item.productionName || '—'}
        </Text>
      </View>
      <View style={[styles.tableCell, styles.tableCellAmount]}>
        <Text style={styles.tableCellAmountText}>{formatCurrency(item.amount)}</Text>
      </View>
      <View style={[styles.tableCell, styles.tableCellAction]}>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          disabled={deleteId === item.id}
          style={styles.deleteButton}
        >
          {deleteId === item.id ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <MaterialIcons name="delete" size={18} color={isDark ? '#9BA1A6' : '#666'} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]} contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Income</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            Track your earnings from productions and gigs
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsModalOpen(true)}
        >
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Add Income</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Income History</Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              Total for {taxYear}: <Text style={styles.totalAmount}>{formatCurrency(totalIncome)}</Text>
            </Text>
          </View>
          <View style={styles.searchContainer}>
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
          <View>
            <View style={[styles.tableHeader, isDark && styles.tableHeaderDark]}>
              <Text style={[styles.tableHeaderText, styles.tableHeaderTextDate, isDark && styles.tableHeaderTextDark]}>
                Date
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderTextType, isDark && styles.tableHeaderTextDark]}>
                Type
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderTextProduction, isDark && styles.tableHeaderTextDark]}>
                Production
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderTextAmount, isDark && styles.tableHeaderTextDark]}>
                Amount
              </Text>
              <View style={styles.tableHeaderTextAction} />
            </View>
            <FlatList
              data={filteredIncome}
              renderItem={renderIncomeItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
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
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>Add Income</Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Net Pay *</Text>
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
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
                <View style={styles.currencyInput}>
                  <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
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
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
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
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
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
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.insurance}
                  onChangeText={(text) => setFormData({ ...formData, insurance: text })}
                  keyboardType="decimal-pad"
                />
              </View>
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
                <Text style={styles.submitButtonText}>Save Income</Text>
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
  totalAmount: {
    fontFamily: 'monospace',
    fontWeight: '600',
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
  },
  badgeDark: {
    backgroundColor: '#4b5563',
  },
  badgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  badgeTextDark: {
    color: '#9BA1A6',
  },
  deleteButton: {
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
