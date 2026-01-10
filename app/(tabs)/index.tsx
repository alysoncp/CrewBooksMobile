import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { apiGet } from '@/lib/api';
import { formatCurrency, getCategoryLabel, getYearFromDateString } from '@/lib/format';
import { type Expense, type Vehicle, HOME_OFFICE_LIVING_CATEGORIES } from '@/lib/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Types
interface Income {
  id: string;
  amount: number | string;
  date: string;
  [key: string]: any;
}

interface TaxCalculation {
  grossIncome: number;
  federalTax: number;
  provincialTax: number;
  cppContribution: number;
}

interface DashboardData {
  income: Income[];
  expenses: Expense[];
  taxCalculation: TaxCalculation;
  monthlyData: Array<{ month: string; income: number; expenses: number }>;
  expensesByCategory: Array<{ category: string; amount: number; color: string }>;
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#84cc16', '#f97316'];

function StatCard({
  title,
  value,
  subtitle,
  iconName,
  trend,
  isLoading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>{title}</Text>
        {iconName && (
          <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
            <MaterialIcons name={iconName} size={16} color={isDark ? '#9BA1A6' : '#666'} />
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        {isLoading ? (
          <ActivityIndicator size="small" color={isDark ? '#9BA1A6' : '#666'} />
        ) : (
          <>
            <View style={styles.valueRow}>
              <Text style={[styles.valueText, isDark && styles.valueTextDark]}>{value}</Text>
              {trend && trend !== 'neutral' && (
                <MaterialIcons
                  name={trend === 'up' ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={trend === 'up' ? '#10b981' : '#ef4444'}
                />
              )}
            </View>
            {subtitle && <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>{subtitle}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

export default function Dashboard() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { taxYear, setTaxYear } = useTaxYear();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleBusinessUseMap, setVehicleBusinessUseMap] = useState<Map<string, number>>(new Map());
  const currentYear = new Date().getFullYear();
  
  // Generate array of years (current year and 5 years back)
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);

  useFocusEffect(
    useCallback(() => {
      const fetchDashboardData = async () => {
        try {
          setIsLoading(true);
          const [dashboardData, vehiclesData] = await Promise.all([
            apiGet<DashboardData>('/api/dashboard'),
            apiGet<Vehicle[]>('/api/vehicles').catch(() => []),
          ]);
          setData(dashboardData);
          setVehicles(vehiclesData);
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
          setData({
            income: [],
            expenses: [],
            taxCalculation: {
              grossIncome: 0,
              federalTax: 0,
              provincialTax: 0,
              cppContribution: 0,
            },
            monthlyData: [],
            expensesByCategory: [],
          });
          setVehicles([]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchDashboardData();
    }, [taxYear])
  );

  // Filter income and expenses by selected year
  const filteredIncome = useMemo(() => {
    return (data?.income || []).filter((item) => {
      const itemYear = getYearFromDateString(item.date);
      return itemYear === taxYear;
    });
  }, [data?.income, taxYear]);

  const filteredExpenses = useMemo(() => {
    return (data?.expenses || []).filter((item) => {
      const itemYear = getYearFromDateString(item.date);
      return itemYear === taxYear;
    }) as Expense[];
  }, [data?.expenses, taxYear]);

  // Helper function to calculate deductible amount for an expense
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

  // Recalculate totals from filtered data
  const totalIncome = filteredIncome.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const netCashflow = totalIncome - totalExpenses;
  
  // Calculate deductible expenses using the helper function
  const deductibleExpenses = useMemo(() => {
    let deductibleSum = 0;
    
    // Create a temporary map with default 100% for vehicles (for summary calculations)
    const tempVehicleMap = new Map<string, number>();
    vehicles.forEach(vehicle => {
      if (vehicle.id) {
        // For summary, use 100% as default - actual calculation happens with fetched percentages
        tempVehicleMap.set(vehicle.id, vehicleBusinessUseMap.get(vehicle.id) || 100);
      }
    });
    
    filteredExpenses.forEach((item) => {
      const result = calculateDeductible(item, tempVehicleMap);
      deductibleSum += result.deductibleAmount;
    });
    
    return deductibleSum;
  }, [filteredExpenses, calculateDeductible, vehicles, vehicleBusinessUseMap]);
  
  const netIncome = totalIncome - deductibleExpenses;

  // For tax calculations
  const originalGrossIncome = data?.taxCalculation?.grossIncome ?? 0;
  const incomeRatio = originalGrossIncome > 0 ? totalIncome / originalGrossIncome : 0;

  const federalTax = (data?.taxCalculation?.federalTax ?? 0) * incomeRatio;
  const provincialTax = (data?.taxCalculation?.provincialTax ?? 0) * incomeRatio;
  const cppContribution = (data?.taxCalculation?.cppContribution ?? 0) * incomeRatio;
  const totalTaxOwed = federalTax + provincialTax + cppContribution;

  // Recalculate expenses by category
  const expensesByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    filteredExpenses.forEach((expense) => {
      const category = expense.category;
      categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(expense.amount.toString());
    });

    return Object.entries(categoryTotals)
      .map(([category, amount], index) => ({
        name: getCategoryLabel(category),
        category: getCategoryLabel(category),
        amount,
        color: CHART_COLORS[index % CHART_COLORS.length],
        legendFontColor: isDark ? '#ECEDEE' : '#11181C',
        legendFontSize: 12,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [filteredExpenses, isDark]);

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, isDark && styles.titleDark]}>Dashboard</Text>
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
              {availableYears.map((year) => (
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

      <View style={styles.statsGrid}>
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome)}
          subtitle="Year to date"
          trend="up"
          isLoading={isLoading}
        />
        <StatCard
          title="Deductible Expenses"
          value={formatCurrency(deductibleExpenses)}
          subtitle="Year to date"
          trend="neutral"
          isLoading={isLoading}
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(netIncome)}
          subtitle="After deductions"
          trend={netIncome > 0 ? 'up' : 'down'}
          isLoading={isLoading}
        />
        <StatCard
          title="Net Cashflow"
          value={formatCurrency(netCashflow)}
          subtitle="Income minus expenses"
          trend={netCashflow > 0 ? 'up' : 'down'}
          isLoading={isLoading}
        />
      </View>

      <View style={[styles.section, isDark && styles.sectionDark]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Expenses by Category</Text>
          <Text style={[styles.sectionDescription, isDark && styles.sectionDescriptionDark]}>
            Distribution of spending
          </Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} style={styles.loader} />
        ) : expensesByCategory.length > 0 ? (
          <>
            <View style={styles.chartContainer}>
              <PieChart
                data={expensesByCategory}
                width={Dimensions.get('window').width - 64}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => isDark ? `rgba(236, 237, 238, ${opacity})` : `rgba(17, 24, 28, ${opacity})`,
                }}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
                hasLegend={false}
              />
            </View>
            <View style={styles.categoryList}>
              {expensesByCategory.slice(0, 5).map((item) => (
                <View key={item.category} style={styles.categoryItem}>
                  <View style={styles.categoryLeft}>
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: item.color },
                      ]}
                    />
                    <Text style={[styles.categoryLabel, isDark && styles.categoryLabelDark]}>{item.category}</Text>
                  </View>
                  <Text style={[styles.categoryAmount, isDark && styles.categoryAmountDark]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>No expenses data available</Text>
        )}
      </View>

      <View style={[styles.section, isDark && styles.sectionDark]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Tax Breakdown</Text>
          <Text style={[styles.sectionDescription, isDark && styles.sectionDescriptionDark]}>
            Estimated tax obligations for {taxYear}
          </Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} style={styles.loader} />
        ) : (
          <View style={styles.taxGrid}>
            <View style={styles.taxItem}>
              <Text style={[styles.taxLabel, isDark && styles.taxLabelDark]}>Federal Tax</Text>
              <Text style={[styles.taxValue, isDark && styles.taxValueDark]}>{formatCurrency(federalTax)}</Text>
            </View>
            <View style={styles.taxItem}>
              <Text style={[styles.taxLabel, isDark && styles.taxLabelDark]}>Provincial Tax</Text>
              <Text style={[styles.taxValue, isDark && styles.taxValueDark]}>{formatCurrency(provincialTax)}</Text>
            </View>
            <View style={styles.taxItem}>
              <Text style={[styles.taxLabel, isDark && styles.taxLabelDark]}>CPP Contribution</Text>
              <Text style={[styles.taxValue, isDark && styles.taxValueDark]}>{formatCurrency(cppContribution)}</Text>
            </View>
            <View style={[styles.taxItem, styles.taxItemTotal]}>
              <Text style={[styles.taxLabel, isDark && styles.taxLabelDark]}>Total Owed</Text>
              <Text style={[styles.taxValue, styles.taxValueTotal]}>
                {formatCurrency(totalTaxOwed)}
              </Text>
            </View>
          </View>
        )}
      </View>
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
    padding: 16,
    paddingBottom: 24,
    marginBottom: 0,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 12,
  },
  cardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitleDark: {
    color: '#9BA1A6',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerDark: {
    backgroundColor: '#374151',
  },
  cardContent: {
    minHeight: 40,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#11181C',
  },
  valueTextDark: {
    color: '#ECEDEE',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  subtitleDark: {
    color: '#9BA1A6',
  },
  section: {
    marginBottom: 24,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
  },
  sectionTitleDark: {
    color: '#ECEDEE',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
  },
  sectionDescriptionDark: {
    color: '#9BA1A6',
  },
  loader: {
    marginVertical: 32,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginVertical: 16,
    width: '100%',
  },
  categoryList: {
    gap: 12,
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginVertical: 32,
  },
  emptyTextDark: {
    color: '#9BA1A6',
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryLabel: {
    fontSize: 14,
    color: '#666',
  },
  categoryLabelDark: {
    color: '#9BA1A6',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
    color: '#11181C',
  },
  categoryAmountDark: {
    color: '#ECEDEE',
  },
  taxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  taxItem: {
    minWidth: '47%',
    marginBottom: 16,
  },
  taxItemTotal: {
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
    paddingLeft: 16,
    minWidth: '100%',
  },
  taxLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  taxLabelDark: {
    color: '#9BA1A6',
  },
  taxValue: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#11181C',
  },
  taxValueDark: {
    color: '#ECEDEE',
  },
  taxValueTotal: {
    fontSize: 20,
    color: '#ef4444',
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
  pickerOptionTextSelected: {
    fontWeight: '600',
    color: '#0a7ea4',
  },
});
