import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { apiGet } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GstHstSummary {
  gstHstCollected: number;
  inputTaxCredits: number;
  netGstHstOwing: number;
  transactionsWithGstHst: number;
}

export default function GstHstPage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { taxYear } = useTaxYear();

  const [gstHstData, setGstHstData] = useState<GstHstSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasGstNumber = user?.hasGstNumber === true;

  useEffect(() => {
    if (hasGstNumber) {
      fetchGstHstData();
    } else {
      setIsLoading(false);
    }
  }, [hasGstNumber, taxYear]);

  const fetchGstHstData = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet<GstHstSummary>(`/api/gst-hst?taxYear=${taxYear}`);
      setGstHstData(data);
    } catch (error: any) {
      console.error('Error fetching GST/HST data:', error);
      Alert.alert('Error', 'Failed to load GST/HST data');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <ScrollView
        style={[styles.container, isDark && styles.containerDark]}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} />
        </View>
      </ScrollView>
    );
  }

  if (!hasGstNumber) {
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
              <Text style={[styles.title, isDark && styles.titleDark]}>GST/HST Tracking</Text>
              <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                Track sales tax collected and input tax credits
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.lockedCard, isDark && styles.lockedCardDark]}>
          <View style={[styles.lockedIcon, isDark && styles.lockedIconDark]}>
            <MaterialIcons name="lock" size={32} color={isDark ? '#9BA1A6' : '#666'} />
          </View>
          <Text style={[styles.lockedTitle, isDark && styles.lockedTitleDark]}>
            GST/HST Registration Required
          </Text>
          <Text style={[styles.lockedDescription, isDark && styles.lockedDescriptionDark]}>
            To access GST/HST tracking, add your GST/HST registration number in your profile
            settings.
          </Text>
          <TouchableOpacity
            style={[styles.addGstButton, isDark && styles.addGstButtonDark]}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.addGstButtonText}>Add GST Number</Text>
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
            <Text style={[styles.title, isDark && styles.titleDark]}>GST/HST Tracking</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Track sales tax collected and input tax credits
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
                <MaterialIcons
                  name="trending-up"
                  size={20}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
                <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>
                  GST/HST Collected
                </Text>
              </View>
              <Text
                style={[
                  styles.statCardValue,
                  styles.statCardValueGreen,
                  isDark && styles.statCardValueGreenDark,
                ]}
              >
                {formatCurrency(gstHstData?.gstHstCollected || 0)}
              </Text>
              <Text style={[styles.statCardSubtitle, isDark && styles.statCardSubtitleDark]}>
                Tax collected on invoiced services
              </Text>
            </View>

            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons
                  name="trending-down"
                  size={20}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
                <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>
                  Input Tax Credits (ITCs)
                </Text>
              </View>
              <Text
                style={[
                  styles.statCardValue,
                  styles.statCardValueBlue,
                  isDark && styles.statCardValueBlueDark,
                ]}
              >
                {formatCurrency(gstHstData?.inputTaxCredits || 0)}
              </Text>
              <Text style={[styles.statCardSubtitle, isDark && styles.statCardSubtitleDark]}>
                GST/HST paid on business expenses
              </Text>
            </View>

            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons
                  name="attach-money"
                  size={20}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
                <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>
                  Net GST/HST Owing
                </Text>
              </View>
              <Text
                style={[
                  styles.statCardValue,
                  (gstHstData?.netGstHstOwing || 0) >= 0
                    ? [styles.statCardValueRed, isDark && styles.statCardValueRedDark]
                    : [styles.statCardValueGreen, isDark && styles.statCardValueGreenDark],
                ]}
              >
                {(gstHstData?.netGstHstOwing || 0) >= 0 ? '' : '-'}
                {formatCurrency(Math.abs(gstHstData?.netGstHstOwing || 0))}
              </Text>
              <Text style={[styles.statCardSubtitle, isDark && styles.statCardSubtitleDark]}>
                {(gstHstData?.netGstHstOwing || 0) >= 0
                  ? 'Amount owing to CRA'
                  : 'Refund expected from CRA'}
              </Text>
            </View>
          </View>

          {/* Summary Card */}
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
                GST/HST Summary
              </Text>
              <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
                Overview of your sales tax obligations for {taxYear}
              </Text>
            </View>

            <View style={[styles.summaryRow, isDark && styles.summaryRowDark]}>
              <View style={styles.summaryRowLeft}>
                <MaterialIcons
                  name="receipt"
                  size={20}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
                <View style={styles.summaryRowText}>
                  <Text style={[styles.summaryRowTitle, isDark && styles.summaryRowTitleDark]}>
                    Transactions with GST/HST
                  </Text>
                  <Text style={[styles.summaryRowSubtitle, isDark && styles.summaryRowSubtitleDark]}>
                    Income and expense entries with sales tax recorded
                  </Text>
                </View>
              </View>
              <View style={[styles.badge, isDark && styles.badgeDark]}>
                <Text
                  style={[styles.badgeText, isDark && styles.badgeTextDark]}
                >
                  {gstHstData?.transactionsWithGstHst || 0}
                </Text>
              </View>
            </View>

            {(gstHstData?.transactionsWithGstHst || 0) === 0 && (
              <View style={[styles.alert, isDark && styles.alertDark]}>
                <MaterialIcons
                  name="info"
                  size={20}
                  color={isDark ? '#60a5fa' : '#3b82f6'}
                />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, isDark && styles.alertTitleDark]}>
                    No GST/HST recorded yet
                  </Text>
                  <Text style={[styles.alertDescription, isDark && styles.alertDescriptionDark]}>
                    Start tracking GST/HST by entering the tax amounts when you add income or
                    expenses. Look for the GST/HST field in the income and expense forms.
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.howItWorks, isDark && styles.howItWorksDark]}>
              <Text style={[styles.howItWorksTitle, isDark && styles.howItWorksTitleDark]}>
                How it works
              </Text>
              <View style={styles.howItWorksList}>
                <Text style={[styles.howItWorksItem, isDark && styles.howItWorksItemDark]}>
                  1. When you invoice clients, enter the GST/HST amount you collected on each
                  income entry.
                </Text>
                <Text style={[styles.howItWorksItem, isDark && styles.howItWorksItemDark]}>
                  2. When you pay for business expenses, enter the GST/HST you paid to claim as
                  Input Tax Credits (ITCs).
                </Text>
                <Text style={[styles.howItWorksItem, isDark && styles.howItWorksItemDark]}>
                  3. Your Net GST/HST Owing is calculated as: Collected - ITCs
                </Text>
                <Text style={[styles.howItWorksItem, isDark && styles.howItWorksItemDark]}>
                  4. File your GST/HST return quarterly or annually depending on your registration.
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
  loader: {
    marginVertical: 32,
    alignItems: 'center',
  },
  lockedCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 32,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  lockedCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  lockedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockedIconDark: {
    backgroundColor: '#374151',
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#11181C',
    textAlign: 'center',
  },
  lockedTitleDark: {
    color: '#ECEDEE',
  },
  lockedDescription: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    maxWidth: 350,
  },
  lockedDescriptionDark: {
    color: '#9BA1A6',
  },
  addGstButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addGstButtonDark: {
    backgroundColor: '#0a7ea4',
  },
  addGstButtonText: {
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
  },
  statCardTitleDark: {
    color: '#9BA1A6',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  statCardValueGreen: {
    color: '#10b981',
  },
  statCardValueGreenDark: {
    color: '#34d399',
  },
  statCardValueBlue: {
    color: '#3b82f6',
  },
  statCardValueBlueDark: {
    color: '#60a5fa',
  },
  statCardValueRed: {
    color: '#ef4444',
  },
  statCardValueRedDark: {
    color: '#f87171',
  },
  statCardSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  statCardSubtitleDark: {
    color: '#9BA1A6',
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
    marginBottom: 16,
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  summaryRowDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  summaryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  summaryRowText: {
    flex: 1,
  },
  summaryRowTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#11181C',
  },
  summaryRowTitleDark: {
    color: '#ECEDEE',
  },
  summaryRowSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  summaryRowSubtitleDark: {
    color: '#9BA1A6',
  },
  badge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDark: {
    backgroundColor: '#374151',
  },
  badgeText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#11181C',
  },
  badgeTextDark: {
    color: '#ECEDEE',
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  alertDark: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1e40af',
  },
  alertTitleDark: {
    color: '#93c5fd',
  },
  alertDescription: {
    fontSize: 12,
    color: '#1e40af',
  },
  alertDescriptionDark: {
    color: '#93c5fd',
  },
  howItWorks: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  howItWorksDark: {
    backgroundColor: '#374151',
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#11181C',
  },
  howItWorksTitleDark: {
    color: '#ECEDEE',
  },
  howItWorksList: {
    gap: 8,
  },
  howItWorksItem: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  howItWorksItemDark: {
    color: '#9BA1A6',
  },
});

