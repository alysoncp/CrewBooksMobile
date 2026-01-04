import { apiGet } from '@/lib/api';
import { formatCurrency, formatPercent, getCategoryLabel, getYearFromDateString } from '@/lib/format';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

// Types - you'll need to import these from your schema or define them
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

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

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
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.iconContainer}>
          <MaterialIcons name={iconName} size={16} color="#666" />
        </View>
      </View>
      <View style={styles.cardContent}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#666" />
        ) : (
          <>
            <View style={styles.valueRow}>
              <Text style={styles.valueText}>{value}</Text>
              {trend && trend !== 'neutral' && (
                <MaterialIcons
                  name={trend === 'up' ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={trend === 'up' ? '#10b981' : '#ef4444'}
                />
              )}
            </View>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const taxYear = new Date().getFullYear(); // Simplified - using current year

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch dashboard data from backend API
        const dashboardData = await apiGet<DashboardData>('/api/dashboard');
        console.log('Dashboard data received:', {
          incomeCount: dashboardData.income?.length || 0,
          expensesCount: dashboardData.expenses?.length || 0,
          hasTaxCalc: !!dashboardData.taxCalculation,
        });
        setData(dashboardData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set empty data on error so UI doesn't break
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Your financial overview for {taxYear}</Text>
        {__DEV__ && data && (
          <Text style={styles.debugText}>
            Data: {data.income?.length || 0} income, {data.expenses?.length || 0} expenses
          </Text>
        )}
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
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{taxLabel}</Text>
            <View style={styles.iconContainer}>
              <MaterialIcons name="calculate" size={16} color="#666" />
            </View>
          </View>
          <View style={styles.cardContent}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#666" />
            ) : (
              <>
                <Text style={[styles.valueText, isRefund ? styles.refundText : styles.owedText]}>
                  {formatCurrency(Math.abs(totalTaxOwed))}
                </Text>
                <Text style={styles.subtitle}>{`${formatPercent(effectiveRate)} effective rate`}</Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Expenses by Category</Text>
          <Text style={styles.sectionDescription}>Distribution of spending</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color="#666" style={styles.loader} />
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
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                </View>
                <Text style={styles.categoryAmount}>{formatCurrency(item.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tax Breakdown</Text>
          <Text style={styles.sectionDescription}>Estimated tax obligations for {taxYear}</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color="#666" style={styles.loader} />
        ) : (
          <View style={styles.taxGrid}>
            <View style={styles.taxItem}>
              <Text style={styles.taxLabel}>Federal Tax</Text>
              <Text style={styles.taxValue}>{formatCurrency(federalTax)}</Text>
            </View>
            <View style={styles.taxItem}>
              <Text style={styles.taxLabel}>Provincial Tax</Text>
              <Text style={styles.taxValue}>{formatCurrency(provincialTax)}</Text>
            </View>
            <View style={styles.taxItem}>
              <Text style={styles.taxLabel}>CPP Contribution</Text>
              <Text style={styles.taxValue}>{formatCurrency(cppContribution)}</Text>
            </View>
            <View style={[styles.taxItem, styles.taxItemTotal]}>
              <Text style={styles.taxLabel}>Total Owed</Text>
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
  contentContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    minWidth: '47%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  refundText: {
    color: '#10b981',
  },
  owedText: {
    color: '#ef4444',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
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
  categoryAmount: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
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
  taxValue: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  taxValueTotal: {
    fontSize: 20,
    color: '#ef4444',
  },
});
