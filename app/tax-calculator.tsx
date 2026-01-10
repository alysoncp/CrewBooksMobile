import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/format';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TaxCalculation {
  grossIncome: number;
  netIncome: number;
  totalExpenses: number;
  federalTax: number;
  provincialTax: number;
  cppContribution: number;
  totalOwed: number;
  marginalTaxRate: number;
  effectiveTaxRate: number;
}

interface User {
  subscriptionTier?: string;
}

interface TaxData {
  calculation: TaxCalculation;
  user: User;
}

export default function TaxCalculatorPage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { taxYear } = useTaxYear();
  const { user } = useAuth();

  const [data, setData] = useState<TaxData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [regularEmploymentIncome, setRegularEmploymentIncome] = useState('');
  const [taxesPaidOnEmployment, setTaxesPaidOnEmployment] = useState('');
  const [cppPaidOnEmployment, setCppPaidOnEmployment] = useState('');

  useEffect(() => {
    fetchTaxData();
  }, [taxYear]);

  const fetchTaxData = async () => {
    try {
      setIsLoading(true);
      const taxData = await apiGet<TaxData>(`/api/tax-calculation?taxYear=${taxYear}`);
      setData(taxData);
    } catch (error: any) {
      console.error('Error fetching tax calculation:', error);
      if (error.message?.includes('403') || error.message?.includes('Unauthorized')) {
        // Handle locked content - user doesn't have access
        setData(null);
      } else {
        Alert.alert('Error', 'Failed to load tax calculation');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const calculation = data?.calculation;
  const isBasicTier = data?.user?.subscriptionTier === 'basic';
  const hasTaxTools = !isBasicTier;

  const regularIncomeValue = parseFloat(regularEmploymentIncome) || 0;
  const taxesPaidValue = parseFloat(taxesPaidOnEmployment) || 0;
  const cppPaidValue = parseFloat(cppPaidOnEmployment) || 0;

  // Calculate adjusted tax totals including regular employment
  const selfEmploymentNetIncome = calculation?.netIncome ?? 0;
  const combinedNetIncome = selfEmploymentNetIncome + regularIncomeValue;

  const selfEmploymentFederalTax = calculation?.federalTax ?? 0;
  const selfEmploymentProvincialTax = calculation?.provincialTax ?? 0;
  const selfEmploymentCPP = calculation?.cppContribution ?? 0;
  const effectiveRate = calculation?.effectiveTaxRate ?? 0;

  const estimatedTaxOnEmployment =
    regularIncomeValue > 0 ? (effectiveRate / 100) * regularIncomeValue : 0;

  const federalTaxRate =
    selfEmploymentNetIncome > 0
      ? selfEmploymentFederalTax / (selfEmploymentFederalTax + selfEmploymentProvincialTax || 1)
      : 0.5;
  const provincialTaxRate = 1 - federalTaxRate;

  const estimatedFederalTaxOnEmployment = estimatedTaxOnEmployment * federalTaxRate;
  const estimatedProvincialTaxOnEmployment = estimatedTaxOnEmployment * provincialTaxRate;

  const adjustedFederalTax = selfEmploymentFederalTax + estimatedFederalTaxOnEmployment;
  const adjustedProvincialTax = selfEmploymentProvincialTax + estimatedProvincialTaxOnEmployment;
  const adjustedTotalIncomeTax = adjustedFederalTax + adjustedProvincialTax;

  // Calculate adjusted CPP considering annual cap
  const getMaxCPPContribution = (year: number): number => {
    const cppParamsByYear: Record<
      number,
      { maxPensionableEarnings: number; basicExemption: number; selfEmployedRate: number }
    > = {
      2020: { maxPensionableEarnings: 58700, basicExemption: 3500, selfEmployedRate: 0.1095 },
      2021: { maxPensionableEarnings: 61600, basicExemption: 3500, selfEmployedRate: 0.1095 },
      2022: { maxPensionableEarnings: 64900, basicExemption: 3500, selfEmployedRate: 0.1115 },
      2023: { maxPensionableEarnings: 66600, basicExemption: 3500, selfEmployedRate: 0.1140 },
      2024: { maxPensionableEarnings: 68500, basicExemption: 3500, selfEmployedRate: 0.1190 },
      2025: { maxPensionableEarnings: 71300, basicExemption: 3500, selfEmployedRate: 0.1190 },
      2026: { maxPensionableEarnings: 74600, basicExemption: 3500, selfEmployedRate: 0.1190 },
    };
    const params = cppParamsByYear[year] || cppParamsByYear[2026];
    const maxContributoryEarnings = params.maxPensionableEarnings - params.basicExemption;
    return maxContributoryEarnings * params.selfEmployedRate;
  };

  const maxCPPContribution = getMaxCPPContribution(taxYear);
  const totalCPPNeeded = selfEmploymentCPP;
  const totalCPPWithEmployment = cppPaidValue + totalCPPNeeded;
  const adjustedCPP = Math.min(totalCPPWithEmployment, maxCPPContribution) - cppPaidValue;
  const adjustedCPPAfterCap = Math.max(0, adjustedCPP);

  const adjustedTotalOwed = adjustedTotalIncomeTax + adjustedCPPAfterCap - taxesPaidValue;
  const adjustedEffectiveRate =
    combinedNetIncome > 0 ? (Math.max(0, adjustedTotalOwed) / combinedNetIncome) * 100 : 0;
  const progressValue = Math.min(adjustedEffectiveRate, 50);

  // Show locked content if API returns 403 or user lacks access
  if (!isLoading && (!hasTaxTools || !data)) {
    return (
      <ScrollView
        style={[styles.container, isDark && styles.containerDark]}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={[styles.title, isDark && styles.titleDark]}>Tax Estimator</Text>
              <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                Projected tax obligations based on your income and expenses
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.lockedContainer, isDark && styles.lockedContainerDark]}>
          <View style={[styles.lockedIcon, isDark && styles.lockedIconDark]}>
            <MaterialIcons name="lock" size={40} color={isDark ? '#9BA1A6' : '#666'} />
          </View>
          <Text style={[styles.lockedTitle, isDark && styles.lockedTitleDark]}>Tax Estimator</Text>
          <Text style={[styles.lockedDescription, isDark && styles.lockedDescriptionDark]}>
            Upgrade to a paid plan to access tax calculations, projections, and detailed bracket
            breakdowns.
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, isDark && styles.upgradeButtonDark]}
            onPress={() => router.push('/profile')}
          >
            <MaterialIcons name="stars" size={20} color="#fff" />
            <Text style={styles.upgradeButtonText}>View Pricing Plans</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, isDark && styles.titleDark]}>Tax Estimator</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Projected tax obligations based on your income and expenses
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} />
        </View>
      ) : (
        <>
          {/* Summary Cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="attach-money" size={20} color={isDark ? '#9BA1A6' : '#666'} />
                <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>
                  Gross Income
                </Text>
              </View>
              <Text style={[styles.statCardValue, isDark && styles.statCardValueDark]}>
                {formatCurrency(calculation?.grossIncome ?? 0)}
              </Text>
            </View>

            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="trending-down" size={20} color={isDark ? '#9BA1A6' : '#666'} />
                <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>
                  Total Deductions
                </Text>
              </View>
              <Text
                style={[
                  styles.statCardValue,
                  styles.statCardValueGreen,
                  isDark && styles.statCardValueGreenDark,
                ]}
              >
                -{formatCurrency(calculation?.totalExpenses ?? 0)}
              </Text>
            </View>

            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons
                  name="calculate"
                  size={20}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
                <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>
                  Net Taxable Income
                </Text>
              </View>
              <Text style={[styles.statCardValue, isDark && styles.statCardValueDark]}>
                {formatCurrency(calculation?.netIncome ?? 0)}
              </Text>
            </View>
          </View>

          {/* Employment Income Inputs */}
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
                Regular Employment Income
              </Text>
              <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
                Include income from regular employment to see combined tax estimate
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.inputLabelDark]}>
                Estimated annual income from regular employment
              </Text>
              <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.inputInCurrency, isDark && styles.inputInCurrencyDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={regularEmploymentIncome}
                  onChangeText={setRegularEmploymentIncome}
                  keyboardType="decimal-pad"
                />
              </View>
              {regularIncomeValue > 0 && (
                <Text style={[styles.inputHelper, isDark && styles.inputHelperDark]}>
                  {formatCurrency(regularIncomeValue)} per year
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.inputLabelDark]}>
                Total taxes already paid on employment income
              </Text>
              <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.inputInCurrency, isDark && styles.inputInCurrencyDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={taxesPaidOnEmployment}
                  onChangeText={setTaxesPaidOnEmployment}
                  keyboardType="decimal-pad"
                />
              </View>
              {taxesPaidValue > 0 && (
                <Text style={[styles.inputHelper, isDark && styles.inputHelperDark]}>
                  {formatCurrency(taxesPaidValue)} paid
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark && styles.inputLabelDark]}>
                CPP contributions already paid on employment income
              </Text>
              <View style={[styles.currencyInput, isDark && styles.currencyInputDark]}>
                <Text style={[styles.currencySymbol, isDark && styles.currencySymbolDark]}>$</Text>
                <TextInput
                  style={[styles.inputInCurrency, isDark && styles.inputInCurrencyDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={cppPaidOnEmployment}
                  onChangeText={setCppPaidOnEmployment}
                  keyboardType="decimal-pad"
                />
              </View>
              {cppPaidValue > 0 && (
                <Text style={[styles.inputHelper, isDark && styles.inputHelperDark]}>
                  {formatCurrency(cppPaidValue)} paid
                </Text>
              )}
            </View>
          </View>

          {/* Tax Breakdown */}
          <View style={styles.statsGrid}>
            <View style={[styles.taxCard, isDark && styles.taxCardDark]}>
              <View style={styles.taxCardHeader}>
                <MaterialIcons name="account-balance" size={24} color="#0a7ea4" />
                <View style={styles.taxCardHeaderText}>
                  <Text style={[styles.taxCardTitle, isDark && styles.taxCardTitleDark]}>
                    Federal Tax
                  </Text>
                  <Text style={[styles.taxCardSubtitle, isDark && styles.taxCardSubtitleDark]}>
                    Canada Revenue Agency
                  </Text>
                </View>
              </View>
              <View style={styles.taxCardRow}>
                <Text style={[styles.taxCardLabel, isDark && styles.taxCardLabelDark]}>
                  Total Federal Tax
                </Text>
                <Text style={[styles.taxCardValue, isDark && styles.taxCardValueDark]}>
                  {formatCurrency(
                    regularIncomeValue > 0 ? adjustedFederalTax : calculation?.federalTax ?? 0
                  )}
                </Text>
              </View>
            </View>

            <View style={[styles.taxCard, isDark && styles.taxCardDark]}>
              <View style={styles.taxCardHeader}>
                <MaterialIcons name="account-balance" size={24} color="#0a7ea4" />
                <View style={styles.taxCardHeaderText}>
                  <Text style={[styles.taxCardTitle, isDark && styles.taxCardTitleDark]}>
                    Provincial Tax
                  </Text>
                  <Text style={[styles.taxCardSubtitle, isDark && styles.taxCardSubtitleDark]}>
                    British Columbia
                  </Text>
                </View>
              </View>
              <View style={styles.taxCardRow}>
                <Text style={[styles.taxCardLabel, isDark && styles.taxCardLabelDark]}>
                  Total Provincial Tax
                </Text>
                <Text style={[styles.taxCardValue, isDark && styles.taxCardValueDark]}>
                  {formatCurrency(
                    regularIncomeValue > 0
                      ? adjustedProvincialTax
                      : calculation?.provincialTax ?? 0
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* Tax Rates */}
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="percent" size={24} color="#0a7ea4" />
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Tax Rates</Text>
                <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
                  Your tax rate information
                </Text>
              </View>
            </View>
            <View style={styles.ratesGrid}>
              <View style={styles.rateItem}>
                <Text style={[styles.rateLabel, isDark && styles.rateLabelDark]}>
                  Marginal Tax Rate
                </Text>
                <Text style={[styles.rateValue, isDark && styles.rateValueDark]}>
                  {formatPercent(calculation?.marginalTaxRate ?? 0)}
                </Text>
                <Text style={[styles.rateHelper, isDark && styles.rateHelperDark]}>
                  Tax rate on next dollar earned
                </Text>
              </View>
              <View style={styles.rateItem}>
                <Text style={[styles.rateLabel, isDark && styles.rateLabelDark]}>
                  Effective Tax Rate
                </Text>
                <Text style={[styles.rateValue, isDark && styles.rateValueDark]}>
                  {formatPercent(calculation?.effectiveTaxRate ?? 0)}
                </Text>
                <Text style={[styles.rateHelper, isDark && styles.rateHelperDark]}>
                  Average tax rate on total income
                </Text>
              </View>
            </View>
          </View>

          {/* CPP Contributions */}
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
                CPP Contributions
              </Text>
              <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
                Canada Pension Plan self-employment contribution ({taxYear})
              </Text>
            </View>
            <View style={styles.cppGrid}>
              <View style={styles.cppInfo}>
                <View style={styles.cppInfoRow}>
                  <Text style={[styles.cppInfoLabel, isDark && styles.cppInfoLabelDark]}>
                    Contribution Rate
                  </Text>
                  <Text style={[styles.cppInfoValue, isDark && styles.cppInfoValueDark]}>11.90%</Text>
                </View>
                <View style={styles.cppInfoRow}>
                  <Text style={[styles.cppInfoLabel, isDark && styles.cppInfoLabelDark]}>
                    Maximum Pensionable Earnings
                  </Text>
                  <Text style={[styles.cppInfoValue, isDark && styles.cppInfoValueDark]}>$68,500</Text>
                </View>
                <View style={styles.cppInfoRow}>
                  <Text style={[styles.cppInfoLabel, isDark && styles.cppInfoLabelDark]}>
                    Basic Exemption
                  </Text>
                  <Text style={[styles.cppInfoValue, isDark && styles.cppInfoValueDark]}>$3,500</Text>
                </View>
              </View>
              <View style={[styles.cppContributionBox, isDark && styles.cppContributionBoxDark]}>
                <Text style={[styles.cppContributionLabel, isDark && styles.cppContributionLabelDark]}>
                  Your CPP Contribution
                </Text>
                <Text
                  style={[
                    styles.cppContributionValue,
                    isDark && styles.cppContributionValueDark,
                  ]}
                >
                  {formatCurrency(
                    regularIncomeValue > 0 || cppPaidValue > 0
                      ? adjustedCPPAfterCap
                      : calculation?.cppContribution ?? 0
                  )}
                </Text>
                {cppPaidValue > 0 && totalCPPWithEmployment > maxCPPContribution && (
                  <Text style={[styles.cppContributionNote, isDark && styles.cppContributionNoteDark]}>
                    Annual cap reached
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Total Tax Owed */}
          <View style={[styles.totalCard, isDark && styles.totalCardDark]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="percent" size={24} color="#ef4444" />
              <View style={styles.cardHeaderText}>
                <Text style={[styles.totalCardTitle, isDark && styles.totalCardTitleDark]}>
                  Total Tax Owed
                </Text>
                <Text style={[styles.totalCardDescription, isDark && styles.totalCardDescriptionDark]}>
                  Combined federal, provincial, and CPP for {taxYear}
                  {regularIncomeValue > 0 && (
                    <Text style={[styles.totalCardDescription, isDark && styles.totalCardDescriptionDark]}>
                      {'\n'}Including regular employment income: {formatCurrency(regularIncomeValue)}
                    </Text>
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.totalGrid}>
              <View style={styles.totalBreakdown}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, isDark && styles.totalLabelDark]}>Federal Tax</Text>
                  <Text style={[styles.totalValue, isDark && styles.totalValueDark]}>
                    {formatCurrency(
                      regularIncomeValue > 0 ? adjustedFederalTax : calculation?.federalTax ?? 0
                    )}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, isDark && styles.totalLabelDark]}>
                    Provincial Tax
                  </Text>
                  <Text style={[styles.totalValue, isDark && styles.totalValueDark]}>
                    {formatCurrency(
                      regularIncomeValue > 0
                        ? adjustedProvincialTax
                        : calculation?.provincialTax ?? 0
                    )}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, isDark && styles.totalLabelDark]}>
                    CPP Contribution
                  </Text>
                  <Text style={[styles.totalValue, isDark && styles.totalValueDark]}>
                    {formatCurrency(
                      regularIncomeValue > 0 || cppPaidValue > 0
                        ? adjustedCPPAfterCap
                        : calculation?.cppContribution ?? 0
                    )}
                  </Text>
                </View>
                {taxesPaidValue > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, styles.totalLabelGreen, isDark && styles.totalLabelGreenDark]}>
                      Less: Taxes Already Paid
                    </Text>
                    <Text
                      style={[
                        styles.totalValue,
                        styles.totalValueGreen,
                        isDark && styles.totalValueGreenDark,
                      ]}
                    >
                      -{formatCurrency(taxesPaidValue)}
                    </Text>
                  </View>
                )}
                {cppPaidValue > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, styles.totalLabelGreen, isDark && styles.totalLabelGreenDark]}>
                      Less: CPP Already Paid
                    </Text>
                    <Text
                      style={[
                        styles.totalValue,
                        styles.totalValueGreen,
                        isDark && styles.totalValueGreenDark,
                      ]}
                    >
                      -{formatCurrency(cppPaidValue)}
                    </Text>
                  </View>
                )}
                {cppPaidValue > 0 && totalCPPWithEmployment > maxCPPContribution && (
                  <View style={styles.totalRow}>
                    <Text
                      style={[
                        styles.totalNote,
                        isDark && styles.totalNoteDark,
                      ]}
                    >
                      Note: Annual CPP cap applied ({formatCurrency(maxCPPContribution)})
                    </Text>
                  </View>
                )}
                <View style={styles.totalSeparator} />
                <View style={styles.totalRow}>
                  <Text style={[styles.totalOwedLabel, isDark && styles.totalOwedLabelDark]}>
                    Total Owed
                  </Text>
                  <Text style={[styles.totalOwedValue, isDark && styles.totalOwedValueDark]}>
                    {formatCurrency(
                      regularIncomeValue > 0 || taxesPaidValue > 0 || cppPaidValue > 0
                        ? Math.max(0, adjustedTotalOwed)
                        : calculation?.totalOwed ?? 0
                    )}
                  </Text>
                </View>
              </View>
              <View style={styles.totalEffectiveRate}>
                <Text style={[styles.effectiveRateLabel, isDark && styles.effectiveRateLabelDark]}>
                  Effective Tax Rate
                </Text>
                <Text style={[styles.effectiveRateValue, isDark && styles.effectiveRateValueDark]}>
                  {formatPercent(regularIncomeValue > 0 ? adjustedEffectiveRate : effectiveRate)}
                </Text>
                <View style={[styles.progressBar, isDark && styles.progressBarDark]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(progressValue, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressHelper, isDark && styles.progressHelperDark]}>
                  Based on net taxable income of{' '}
                  {formatCurrency(
                    regularIncomeValue > 0 ? combinedNetIncome : calculation?.netIncome ?? 0
                  )}
                </Text>
              </View>
            </View>
          </View>
        </>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerText: {
    flex: 1,
    flexShrink: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
    flexShrink: 1,
  },
  titleDark: {
    color: '#ECEDEE',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  subtitleDark: {
    color: '#9BA1A6',
  },
  loader: {
    marginVertical: 32,
    alignItems: 'center',
  },
  lockedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 400,
  },
  lockedContainerDark: {
    backgroundColor: '#1f2937',
  },
  lockedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lockedIconDark: {
    backgroundColor: '#374151',
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#11181C',
  },
  lockedTitleDark: {
    color: '#ECEDEE',
  },
  lockedDescription: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    maxWidth: 400,
  },
  lockedDescriptionDark: {
    color: '#9BA1A6',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonDark: {
    backgroundColor: '#0a7ea4',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
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
    flex: 1,
    minWidth: '47%',
  },
  statCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statCardTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  statCardTitleDark: {
    color: '#9BA1A6',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#11181C',
    flexShrink: 1,
  },
  statCardValueDark: {
    color: '#ECEDEE',
  },
  statCardValueGreen: {
    color: '#10b981',
  },
  statCardValueGreenDark: {
    color: '#34d399',
  },
  card: {
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
    marginBottom: 16,
  },
  cardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  cardTitleDark: {
    color: '#ECEDEE',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  cardDescriptionDark: {
    color: '#9BA1A6',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  inputLabelDark: {
    color: '#9BA1A6',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currencyInputDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    paddingLeft: 16,
    paddingRight: 8,
    color: '#11181C',
  },
  currencySymbolDark: {
    color: '#ECEDEE',
  },
  inputInCurrency: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 14,
    paddingRight: 16,
    fontFamily: 'monospace',
    color: '#11181C',
    backgroundColor: 'transparent',
  },
  inputInCurrencyDark: {
    color: '#ECEDEE',
  },
  inputHelper: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#666',
    marginTop: 4,
  },
  inputHelperDark: {
    color: '#9BA1A6',
  },
  taxCard: {
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
    flex: 1,
    minWidth: '47%',
    marginBottom: 16,
  },
  taxCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  taxCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  taxCardHeaderText: {
    flex: 1,
  },
  taxCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  taxCardTitleDark: {
    color: '#ECEDEE',
  },
  taxCardSubtitle: {
    fontSize: 12,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  taxCardSubtitleDark: {
    color: '#9BA1A6',
  },
  taxCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  taxCardLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
    flex: 1,
  },
  taxCardLabelDark: {
    color: '#ECEDEE',
  },
  taxCardValue: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#11181C',
    flexShrink: 0,
    marginLeft: 8,
  },
  taxCardValueDark: {
    color: '#ECEDEE',
  },
  ratesGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  rateItem: {
    flex: 1,
  },
  rateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  rateLabelDark: {
    color: '#9BA1A6',
  },
  rateValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 4,
    color: '#11181C',
    flexShrink: 1,
  },
  rateValueDark: {
    color: '#ECEDEE',
  },
  rateHelper: {
    fontSize: 12,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  rateHelperDark: {
    color: '#9BA1A6',
  },
  cppGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  cppInfo: {
    flex: 1,
    gap: 12,
  },
  cppInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cppInfoLabel: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
    flex: 1,
  },
  cppInfoLabelDark: {
    color: '#9BA1A6',
  },
  cppInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
    color: '#11181C',
    flexShrink: 0,
    marginLeft: 8,
  },
  cppInfoValueDark: {
    color: '#ECEDEE',
  },
  cppContributionBox: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cppContributionBoxDark: {
    backgroundColor: '#374151',
  },
  cppContributionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  cppContributionLabelDark: {
    color: '#9BA1A6',
  },
  cppContributionValue: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#11181C',
    flexShrink: 1,
  },
  cppContributionValueDark: {
    color: '#ECEDEE',
  },
  cppContributionNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 8,
  },
  cppContributionNoteDark: {
    color: '#9BA1A6',
  },
  totalCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  totalCardDark: {
    backgroundColor: '#7f1d1d',
    borderColor: '#991b1b',
  },
  totalCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#dc2626',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  totalCardTitleDark: {
    color: '#fca5a5',
  },
  totalCardDescription: {
    fontSize: 14,
    color: '#991b1b',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  totalCardDescriptionDark: {
    color: '#fca5a5',
  },
  totalGrid: {
    gap: 16,
  },
  totalBreakdown: {
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  totalLabel: {
    fontSize: 14,
    color: '#991b1b',
    flexShrink: 1,
    flexWrap: 'wrap',
    flex: 1,
  },
  totalLabelDark: {
    color: '#fca5a5',
  },
  totalLabelGreen: {
    color: '#059669',
  },
  totalLabelGreenDark: {
    color: '#34d399',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'monospace',
    color: '#991b1b',
    flexShrink: 0,
    marginLeft: 8,
  },
  totalValueDark: {
    color: '#fca5a5',
  },
  totalValueGreen: {
    color: '#059669',
  },
  totalValueGreenDark: {
    color: '#34d399',
  },
  totalNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#991b1b',
    textAlign: 'center',
    width: '100%',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  totalNoteDark: {
    color: '#fca5a5',
  },
  totalSeparator: {
    height: 1,
    backgroundColor: '#fecaca',
    marginVertical: 8,
  },
  totalOwedLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991b1b',
    flexShrink: 1,
    flexWrap: 'wrap',
    flex: 1,
  },
  totalOwedLabelDark: {
    color: '#fca5a5',
  },
  totalOwedValue: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#dc2626',
    flexShrink: 0,
    marginLeft: 8,
  },
  totalOwedValueDark: {
    color: '#fca5a5',
  },
  totalEffectiveRate: {
    alignItems: 'center',
    gap: 8,
  },
  effectiveRateLabel: {
    fontSize: 14,
    color: '#991b1b',
    flexShrink: 1,
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  effectiveRateLabelDark: {
    color: '#fca5a5',
  },
  effectiveRateValue: {
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#dc2626',
    flexShrink: 1,
  },
  effectiveRateValueDark: {
    color: '#fca5a5',
  },
  progressBar: {
    width: '100%',
    height: 12,
    backgroundColor: '#fecaca',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarDark: {
    backgroundColor: '#991b1b',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#dc2626',
  },
  progressHelper: {
    fontSize: 12,
    color: '#991b1b',
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  progressHelperDark: {
    color: '#fca5a5',
  },
});

