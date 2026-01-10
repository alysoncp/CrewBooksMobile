import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HelpSection {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  content: string[];
}

export default function Help() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const helpSections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: 'play-circle-outline',
      content: [
        'Welcome to Crew Books! This app helps you manage your finances for tax purposes.',
        'Start by setting up your profile with your tax filing status and user type.',
        'Add your income entries and expenses throughout the year.',
        'Use the dashboard to track your financial overview.',
        'Configure your expense categories in Expense Settings to match your needs.',
      ],
    },
    {
      id: 'income',
      title: 'Managing Income',
      icon: 'attach-money',
      content: [
        'Add income entries by tapping the + button on the Income tab.',
        'Select the income type (Union Production, Non-Union Production, Royalty/Residual, or Cash).',
        'Enter the amount, date, and production name if applicable.',
        'Upload paystub images for record keeping.',
        'Filter income by type, accounting office, or date range.',
      ],
    },
    {
      id: 'expenses',
      title: 'Managing Expenses',
      icon: 'receipt',
      content: [
        'Add expenses by tapping the + button on the Expenses tab.',
        'Select a category that matches your expense type.',
        'Enter the amount, date, and any additional details.',
        'Upload receipt images for documentation.',
        'Mark expenses as tax-deductible if applicable.',
        'Filter expenses by category, date range, or tax-deductible status.',
      ],
    },
    {
      id: 'mileage',
      title: 'Vehicle Mileage Tracking',
      icon: 'directions-car',
      content: [
        'Add vehicles in the Vehicles section from the More tab.',
        'Log mileage entries with odometer readings or trip distances.',
        'Mark trips as business or personal use.',
        'Upload odometer photos for documentation.',
        'The app calculates your business use percentage automatically.',
      ],
    },
    {
      id: 'tax-year',
      title: 'Tax Year Management',
      icon: 'calendar-today',
      content: [
        'Select your tax year from the dropdown in the More tab or Dashboard.',
        'All data is filtered by the selected tax year.',
        'Switch between years to view historical data.',
        'The app supports viewing data for the current year and up to 5 years back.',
      ],
    },
    {
      id: 'expense-settings',
      title: 'Expense Settings',
      icon: 'settings',
      content: [
        'Configure which expense categories are available in your app.',
        'Enable or disable categories based on your needs.',
        'Set your home office percentage for applicable expenses.',
        'Customize personal expense categories if needed.',
      ],
    },
    {
      id: 'dashboard',
      title: 'Dashboard Overview',
      icon: 'dashboard',
      content: [
        'View your total income, deductible expenses, and net income.',
        'See your expenses broken down by category in a visual chart.',
        'Review estimated tax calculations for the selected tax year.',
        'Track your net cashflow (income minus expenses).',
      ],
    },
    {
      id: 'tax-calculator',
      title: 'Tax Calculator',
      icon: 'calculate',
      content: [
        'Access the Tax Calculator from the More tab.',
        'View detailed tax breakdowns including federal tax, provincial tax, and CPP contributions.',
        'See your marginal and effective tax rates.',
        'Use this tool to estimate your tax obligations.',
      ],
    },
    {
      id: 'gst-hst',
      title: 'GST/HST Tracking',
      icon: 'receipt-long',
      content: [
        'Track GST/HST collected and input tax credits.',
        'View your net GST/HST owing or refund.',
        'See the number of transactions with GST/HST.',
        'Available if you have a GST/HST number configured in your profile.',
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: 'build',
      content: [
        'If data is not loading, check your internet connection.',
        'Try refreshing by pulling down on the screen.',
        'Make sure you\'re logged in with a valid account.',
        'Clear the app cache if you experience persistent issues.',
        'Contact support if problems persist.',
      ],
    },
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return helpSections;
    }

    const query = searchQuery.toLowerCase().trim();
    return helpSections.filter((section) => {
      // Check if title matches
      if (section.title.toLowerCase().includes(query)) {
        return true;
      }
      // Check if any content item matches
      return section.content.some((item) => item.toLowerCase().includes(query));
    });
  }, [searchQuery]);

  // Auto-expand sections when searching (first matching section)
  const shouldExpand = (sectionId: string) => {
    if (searchQuery.trim() && filteredSections.length > 0) {
      // When searching, auto-expand matching sections
      const isMatching = filteredSections.some((s) => s.id === sectionId);
      return expandedSection === sectionId || (isMatching && expandedSection === null);
    }
    return expandedSection === sectionId;
  };

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }]}
    >
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Help & Support</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            Get help using Crew Books
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
        <MaterialIcons
          name="search"
          size={20}
          color={isDark ? '#9BA1A6' : '#666'}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, isDark && styles.searchInputDark]}
          placeholder="Search help topics..."
          placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="close"
              size={20}
              color={isDark ? '#9BA1A6' : '#666'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Help Sections */}
      {filteredSections.length === 0 ? (
        <View style={[styles.noResultsContainer, isDark && styles.noResultsContainerDark]}>
          <MaterialIcons
            name="search-off"
            size={48}
            color={isDark ? '#9BA1A6' : '#666'}
            style={styles.noResultsIcon}
          />
          <Text style={[styles.noResultsText, isDark && styles.noResultsTextDark]}>
            No results found
          </Text>
          <Text style={[styles.noResultsSubtext, isDark && styles.noResultsSubtextDark]}>
            Try searching with different keywords
          </Text>
        </View>
      ) : (
        filteredSections.map((section) => {
          const isExpanded = shouldExpand(section.id);
          // Highlight matching sections in search
          const titleMatches = searchQuery.trim() && section.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
          
          return (
            <View key={section.id} style={[styles.section, isDark && styles.sectionDark]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.id)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <MaterialIcons
                    name={section.icon}
                    size={24}
                    color={isDark ? '#0a7ea4' : '#0a7ea4'}
                  />
                  <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
                    {section.title}
                  </Text>
                </View>
                <MaterialIcons
                  name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
              </TouchableOpacity>
              {isExpanded && (
                <View style={styles.sectionContent}>
                  {section.content.map((item, index) => {
                    // Highlight matching content when searching
                    const contentMatches = searchQuery.trim() && item.toLowerCase().includes(searchQuery.toLowerCase().trim());
                    return (
                      <View key={index} style={styles.contentItem}>
                        <MaterialIcons
                          name="chevron-right"
                          size={16}
                          color={isDark ? '#9BA1A6' : '#666'}
                          style={styles.bulletIcon}
                        />
                        <Text style={[styles.contentText, isDark && styles.contentTextDark, contentMatches && styles.highlightedText]}>
                          {item}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Contact Support Section - only show if no search or search matches */}
      {(!searchQuery.trim() || searchQuery.toLowerCase().includes('support') || searchQuery.toLowerCase().includes('contact') || searchQuery.toLowerCase().includes('help')) && (
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="support-agent" size={24} color={isDark ? '#0a7ea4' : '#0a7ea4'} />
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Need More Help?
            </Text>
          </View>
          <Text style={[styles.description, isDark && styles.descriptionDark]}>
            If you can't find what you're looking for, please contact our support team for assistance.
          </Text>
          <Text style={[styles.description, isDark && styles.descriptionDark]}>
            You can reach us through the web app or by emailing support directly.
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, isDark && styles.footerDark]}>
        <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
          © {new Date().getFullYear()} Crew Books
        </Text>
        <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
          All rights reserved
        </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    marginBottom: 20,
    height: 48,
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
    fontSize: 16,
    color: '#11181C',
    paddingVertical: 0,
  },
  searchInputDark: {
    color: '#ECEDEE',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  section: {
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
  sectionDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    flex: 1,
  },
  sectionTitleDark: {
    color: '#ECEDEE',
  },
  sectionContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    flex: 1,
  },
  contentTextDark: {
    color: '#9BA1A6',
  },
  highlightedText: {
    backgroundColor: 'rgba(10, 126, 164, 0.15)',
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 3,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    marginTop: 12,
  },
  descriptionDark: {
    color: '#9BA1A6',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  noResultsContainerDark: {
    backgroundColor: 'transparent',
  },
  noResultsIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultsTextDark: {
    color: '#ECEDEE',
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  noResultsSubtextDark: {
    color: '#9BA1A6',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerDark: {
    borderTopColor: '#374151',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  footerTextDark: {
    color: '#9BA1A6',
  },
});
