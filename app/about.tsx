import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function About() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
          <Text style={[styles.title, isDark && styles.titleDark]}>About</Text>
          <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
            Crew Books Mobile App
          </Text>
        </View>
      </View>

      {/* App Info Section */}
      <View style={[styles.section, isDark && styles.sectionDark]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="info" size={24} color={isDark ? '#0a7ea4' : '#0a7ea4'} />
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>App Information</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, isDark && styles.infoLabelDark]}>Version</Text>
          <Text style={[styles.infoValue, isDark && styles.infoValueDark]}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, isDark && styles.infoLabelDark]}>Platform</Text>
          <Text style={[styles.infoValue, isDark && styles.infoValueDark]}>React Native (Expo)</Text>
        </View>
      </View>

      {/* Description Section */}
      <View style={[styles.section, isDark && styles.sectionDark]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="description" size={24} color={isDark ? '#0a7ea4' : '#0a7ea4'} />
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>About Crew Books</Text>
        </View>
        <Text style={[styles.description, isDark && styles.descriptionDark]}>
          Crew Books is a comprehensive financial management application designed for professionals in the film and entertainment industry. 
          Track your income, manage expenses, log vehicle mileage, and prepare for tax season—all in one convenient mobile app.
        </Text>
        <Text style={[styles.description, isDark && styles.descriptionDark]}>
          Key features include receipt scanning with OCR technology, automatic expense categorization, income tracking, 
          vehicle mileage logging, and comprehensive tax reporting tools.
        </Text>
      </View>

      {/* Features Section */}
      <View style={[styles.section, isDark && styles.sectionDark]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="star" size={24} color={isDark ? '#0a7ea4' : '#0a7ea4'} />
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Key Features</Text>
        </View>
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={isDark ? '#10b981' : '#10b981'} />
            <Text style={[styles.featureText, isDark && styles.featureTextDark]}>
              Receipt scanning with OCR
            </Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={isDark ? '#10b981' : '#10b981'} />
            <Text style={[styles.featureText, isDark && styles.featureTextDark]}>
              Income and expense tracking
            </Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={isDark ? '#10b981' : '#10b981'} />
            <Text style={[styles.featureText, isDark && styles.featureTextDark]}>
              Vehicle mileage logging
            </Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={isDark ? '#10b981' : '#10b981'} />
            <Text style={[styles.featureText, isDark && styles.featureTextDark]}>
              Tax year management
            </Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={isDark ? '#10b981' : '#10b981'} />
            <Text style={[styles.featureText, isDark && styles.featureTextDark]}>
              Comprehensive financial reports
            </Text>
          </View>
        </View>
      </View>

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
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  sectionTitleDark: {
    color: '#ECEDEE',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoLabelDark: {
    color: '#9BA1A6',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
  },
  infoValueDark: {
    color: '#ECEDEE',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    marginBottom: 12,
  },
  descriptionDark: {
    color: '#9BA1A6',
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#11181C',
    flex: 1,
  },
  featureTextDark: {
    color: '#ECEDEE',
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

