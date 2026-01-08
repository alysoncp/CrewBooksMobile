import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MenuItem {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  showChevron?: boolean;
}

interface MenuSection {
  title?: string;
  items: MenuItem[];
}

export default function More() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { taxYear, setTaxYear } = useTaxYear();
  const [showYearPicker, setShowYearPicker] = useState(false);
  const currentYear = new Date().getFullYear();

  // Generate array of years (current year and 5 years back)
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Add logout API call if available
              // For now, just navigate to login
              router.replace('/login');
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const menuSections: MenuSection[] = [
    {
      title: 'Tools',
      items: [
        {
          title: 'Tax Estimator',
          icon: 'calculate',
          onPress: () => {
            router.push('/tax-calculator');
          },
          showChevron: true,
        },
        {
          title: 'GST/HST Tracking',
          icon: 'receipt',
          onPress: () => {
            router.push('/gst-hst');
          },
          showChevron: true,
        },
      ],
    },
    {
      items: [
        {
          title: 'Profile',
          icon: 'person',
          onPress: () => {
            router.push('/profile');
          },
          showChevron: true,
        },
        {
          title: 'Manage Vehicles',
          icon: 'directions-car',
          onPress: () => {
            router.push('/vehicles');
          },
          showChevron: true,
        },
        {
          title: 'Expense Settings',
          icon: 'settings',
          onPress: () => {
            router.push('/expense-settings');
          },
          showChevron: true,
        },
      ],
    },
    {
      items: [
        {
          title: 'Help & Support',
          icon: 'help-outline',
          onPress: () => {
            // TODO: Navigate to help page when available
            Alert.alert('Help & Support', 'Help page coming soon');
          },
          showChevron: true,
        },
        {
          title: 'About',
          icon: 'info-outline',
          onPress: () => {
            router.push('/about');
          },
          showChevron: true,
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.titleDark]}>More</Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
          Settings and additional options
        </Text>
      </View>

      <View style={[styles.taxYearSection, isDark && styles.taxYearSectionDark]}>
        <View style={styles.taxYearHeader}>
          <Text style={[styles.taxYearLabel, isDark && styles.taxYearLabelDark]}>Tax Year</Text>
          <Text style={[styles.taxYearDescription, isDark && styles.taxYearDescriptionDark]}>
            Select the tax year for viewing your finances
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.taxYearPicker, isDark && styles.taxYearPickerDark]}
          onPress={() => setShowYearPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.taxYearValue, isDark && styles.taxYearValueDark]}>
            {taxYear}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
        </TouchableOpacity>
      </View>

      {menuSections.map((section, sectionIndex) => (
        <View
          key={sectionIndex}
          style={[
            styles.menuSection,
            isDark && styles.menuSectionDark,
            sectionIndex !== menuSections.length - 1 && styles.menuSectionMargin,
          ]}
        >
          {section.title && (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeaderText, isDark && styles.sectionHeaderTextDark]}>
                {section.title}
              </Text>
            </View>
          )}
          {section.items.map((item, itemIndex) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.menuItem,
                itemIndex !== section.items.length - 1 && styles.menuItemBorder,
                isDark && styles.menuItemDark,
                itemIndex !== section.items.length - 1 && isDark && styles.menuItemBorderDark,
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuItemIcon, isDark && styles.menuItemIconDark]}>
                  <MaterialIcons
                    name={item.icon}
                    size={24}
                    color={isDark ? '#ECEDEE' : '#11181C'}
                  />
                </View>
                <Text style={[styles.menuItemText, isDark && styles.menuItemTextDark]}>
                  {item.title}
                </Text>
              </View>
              {item.showChevron && (
                <MaterialIcons name="chevron-right" size={24} color={isDark ? '#9BA1A6' : '#666'} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.logoutButton, isDark && styles.logoutButtonDark]}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <MaterialIcons name="logout" size={24} color="#ef4444" />
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Year Picker Modal */}
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
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  subtitleDark: {
    color: '#9BA1A6',
  },
  taxYearSection: {
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
    marginBottom: 24,
  },
  taxYearSectionDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  taxYearHeader: {
    marginBottom: 12,
  },
  taxYearLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
  },
  taxYearLabelDark: {
    color: '#ECEDEE',
  },
  taxYearDescription: {
    fontSize: 14,
    color: '#666',
  },
  taxYearDescriptionDark: {
    color: '#9BA1A6',
  },
  taxYearPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  taxYearPickerDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  taxYearValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#11181C',
  },
  taxYearValueDark: {
    color: '#ECEDEE',
  },
  menuSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  menuSectionDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  menuSectionMargin: {
    marginBottom: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderTextDark: {
    color: '#9BA1A6',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemDark: {
    backgroundColor: '#1f2937',
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuItemBorderDark: {
    borderBottomColor: '#374151',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemIconDark: {
    backgroundColor: '#374151',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#11181C',
  },
  menuItemTextDark: {
    color: '#ECEDEE',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
    gap: 8,
  },
  logoutButtonDark: {
    backgroundColor: '#1f2937',
    borderColor: '#7f1d1d',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
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

