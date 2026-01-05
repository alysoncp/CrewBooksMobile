import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MenuItem {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  showChevron?: boolean;
}

export default function More() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

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

  const menuItems: MenuItem[] = [
    {
      title: 'Settings',
      icon: 'settings',
      onPress: () => {
        // TODO: Navigate to settings page when available
        Alert.alert('Settings', 'Settings page coming soon');
      },
      showChevron: true,
    },
    {
      title: 'Vehicles',
      icon: 'directions-car',
      onPress: () => {
        // TODO: Navigate to vehicles page when available
        Alert.alert('Vehicles', 'Vehicles management coming soon');
      },
      showChevron: true,
    },
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
        // TODO: Navigate to about page when available
        Alert.alert('About', 'About page coming soon');
      },
      showChevron: true,
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

      <View style={[styles.menuSection, isDark && styles.menuSectionDark]}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.title}
            style={[
              styles.menuItem,
              index !== menuItems.length - 1 && styles.menuItemBorder,
              isDark && styles.menuItemDark,
              index !== menuItems.length - 1 && isDark && styles.menuItemBorderDark,
            ]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuItemIcon, isDark && styles.menuItemIconDark]}>
                <MaterialIcons name={item.icon} size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
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

      <TouchableOpacity
        style={[styles.logoutButton, isDark && styles.logoutButtonDark]}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <MaterialIcons name="logout" size={24} color="#ef4444" />
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>
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
  },
  menuSectionDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
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
});

