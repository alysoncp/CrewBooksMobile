import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatPercent, getCategoryLabel, getYearFromDateString } from '@/lib/format';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

// Types
interface Income {
  id: string;
  amount: number | string;
  date: string;
  [key: string]: any;
}

interface Expense {
  id: string;
  amount: number | string;
  date: string;
  category: string;
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
  iconName: keyof typeof MaterialIcons.glyphMap;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>{title}</Text>
        <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
          <MaterialIcons name={iconName} size={16} color={isDark ? '#9BA1A6' : '#666'} />
        </View>
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const taxYear = new Date().getFullYear();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const dashboardData = await apiGet<DashboardData>('/api/dashboard');
        setData(dashboardData);
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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
    });
  }, [data?.expenses, taxYear]);

  // Recalculate totals from filtered data
  const totalIncome = filteredIncome.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const netIncome = totalIncome - totalExpenses;

  // For tax calculations
  const originalGrossIncome = data?.taxCalculation?.grossIncome ?? 0;
  const incomeRatio = originalGrossIncome > 0 ? totalIncome / originalGrossIncome : 0;

  const federalTax = (data?.taxCalculation?.federalTax ?? 0) * incomeRatio;
  const provincialTax = (data?.taxCalculation?.provincialTax ?? 0) * incomeRatio;
  const cppContribution = (data?.taxCalculation?.cppContribution ?? 0) * incomeRatio;
  const totalTaxOwed = federalTax + provincialTax + cppContribution;
  const effectiveRate = netIncome > 0 ? (totalTaxOwed / netIncome) * 100 : 0;

  const isRefund = totalTaxOwed < 0;
  const taxLabel = isRefund ? 'Estimated CRA Refund' : 'Estimated CRA Owing';

  // Recalculate expenses by category
  const expensesByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    filteredExpenses.forEach((expense) => {
      const category = expense.category;
      categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(expense.amount.toString());
    });

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category: getCategoryLabel(category),
        amount,
        color: '',
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [filteredExpenses]);

  return (
    <ScrollView 
      style={[styles.container, isDark && styles.containerDark]} 
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.titleDark]}>Dashboard</Text>
        <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
          Your financial overview for {taxYear}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome)}
          subtitle="Year to date"
          iconName="attach-money"
          trend="up"
          isLoading={isLoading}
        />
        <StatCard
          title="Deductible Expenses"
          value={formatCurrency(totalExpenses)}
          subtitle="Year to date"
          iconName="receipt"
          trend="neutral"
          isLoading={isLoading}
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(netIncome)}
          subtitle="After deductions"
          iconName="trending-up"
          trend={netIncome > 0 ? 'up' : 'down'}
          isLoading={isLoading}
        />
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>{taxLabel}</Text>
            <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
              <MaterialIcons name="calculate" size={16} color={isDark ? '#9BA1A6' : '#666'} />
            </View>
          </View>
          <View style={styles.cardContent}>
            {isLoading ? (
              <ActivityIndicator size="small" color={isDark ? '#9BA1A6' : '#666'} />
            ) : (
              <>
                <Text style={[styles.valueText, isRefund ? styles.refundText : styles.owedText]}>
                  {formatCurrency(Math.abs(totalTaxOwed))}
                </Text>
                <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                  {`${formatPercent(effectiveRate)} effective rate`}
                </Text>
              </>
            )}
          </View>
        </View>
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
        ) : (
          <View style={styles.categoryList}>
            {expensesByCategory.slice(0, 5).map((item, index) => (
              <View key={item.category} style={styles.categoryItem}>
                <View style={styles.categoryLeft}>
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: CHART_COLORS[index % CHART_COLORS.length] },
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
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
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
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerSubtitleDark: {
    color: '#9BA1A6',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    minWidth: '47%',
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
  refundText: {
    color: '#10b981',
  },
  owedText: {
    color: '#ef4444',
  },
  section: {
    marginBottom: 24,
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
  categoryList: {
    gap: 12,
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
});
