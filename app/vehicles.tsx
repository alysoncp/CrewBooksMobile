import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiGet, apiRequest } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { type Vehicle } from '@/lib/types';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VehicleFormData {
  name: string;
  make: string;
  model: string;
  isPrimary: boolean;
  usedExclusivelyForBusiness: boolean;
  claimsCca: boolean;
  ccaClass: string;
  currentMileage: string;
  totalAnnualMileage: string;
  purchasedThisYear: boolean;
  purchasePrice: string;
}

export default function VehiclesPage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { taxYear } = useTaxYear();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCcaClassPicker, setShowCcaClassPicker] = useState(false);
  const [mileageLoggingStyle, setMileageLoggingStyle] = useState<'trip_distance' | 'odometer'>('trip_distance');
  const [showMileageStylePicker, setShowMileageStylePicker] = useState(false);
  const [newlyCreatedVehicleId, setNewlyCreatedVehicleId] = useState<string | null>(null);
  const [showInitialPhotoPrompt, setShowInitialPhotoPrompt] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState<Record<string, number>>({});
  const [showYearStartPrompt, setShowYearStartPrompt] = useState(false);
  const [vehiclesNeedingYearStartPhoto, setVehiclesNeedingYearStartPhoto] = useState<Vehicle[]>([]);
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, any[]>>({});

  const [formData, setFormData] = useState<VehicleFormData>({
    name: '',
    make: '',
    model: '',
    isPrimary: false,
    usedExclusivelyForBusiness: false,
    claimsCca: false,
    ccaClass: '',
    currentMileage: '',
    totalAnnualMileage: '',
    purchasedThisYear: false,
    purchasePrice: '',
  });

  useEffect(() => {
    fetchVehicles();
    fetchMileageLoggingStyle();
    loadDismissedReminders();
  }, []);

  // Load dismissed reminders from AsyncStorage on mount
  const loadDismissedReminders = async () => {
    try {
      const stored = await AsyncStorage.getItem('odometerPhotoReminders');
      if (stored) {
        setDismissedReminders(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load dismissed reminders', e);
    }
  };

  // Helper to check if reminder should be shown for a vehicle
  const shouldShowReminder = (vehicleId: string): boolean => {
    const dismissedTime = dismissedReminders[vehicleId];
    if (!dismissedTime) return true; // Never dismissed, show it
    const hoursSinceDismissal = (Date.now() - dismissedTime) / (1000 * 60 * 60);
    return hoursSinceDismissal >= 24; // Show again after 24 hours
  };

  // Dismiss reminder for a vehicle
  const dismissReminder = async (vehicleId: string) => {
    const updated = { ...dismissedReminders, [vehicleId]: Date.now() };
    setDismissedReminders(updated);
    try {
      await AsyncStorage.setItem('odometerPhotoReminders', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save dismissed reminder', e);
    }
  };

  const fetchVehicles = async () => {
    try {
      const data = await apiGet<Vehicle[]>('/api/vehicles');
      setVehicles(data);
      // Fetch photos for all vehicles (this will also check for year-start photos)
      await fetchVehiclePhotos(data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      Alert.alert('Error', 'Failed to load vehicles');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVehiclePhotos = async (vehiclesList: Vehicle[]) => {
    const photosMap: Record<string, any[]> = {};
    for (const vehicle of vehiclesList) {
      try {
        const photos = await apiGet<any[]>(`/api/vehicles/${vehicle.id}/odometer-photos`);
        photosMap[vehicle.id] = photos || [];
      } catch (error) {
        // Silently fail - vehicle may not have photos endpoint yet
        photosMap[vehicle.id] = [];
      }
    }
    setVehiclePhotos(photosMap);
    // Check for year-start photos after photos are loaded
    checkYearStartPhotos(vehiclesList, photosMap);
  };

  const checkYearStartPhotos = (vehiclesList: Vehicle[], photosMap: Record<string, any[]>) => {
    const currentYear = new Date().getFullYear().toString();
    const currentYearStart = `${currentYear}-01-01`;
    const vehiclesNeedingPhotos: Vehicle[] = [];

    for (const vehicle of vehiclesList) {
      try {
        const photos = photosMap[vehicle.id] || [];
        const currentYearPhotos = photos.filter((photo: any) => {
          const photoDate = photo.photoDate || photo.readingDate || '';
          return photoDate >= currentYearStart;
        });

        if (currentYearPhotos.length === 0) {
          // Check if there are any photos at all (from previous years)
          if (photos.length === 0 || (photos.length > 0 && (photos[0].photoDate || photos[0].readingDate || '') < currentYearStart)) {
            vehiclesNeedingPhotos.push(vehicle);
          }
        }
      } catch (e) {
        console.error(`Failed to check photos for vehicle ${vehicle.id}`, e);
      }
    }

    if (vehiclesNeedingPhotos.length > 0) {
      setVehiclesNeedingYearStartPhoto(vehiclesNeedingPhotos);
      // Check if we should show the prompt (not dismissed today)
      const dismissedKey = `yearStartPrompt_${currentYear}`;
      const dismissedTime = dismissedReminders[dismissedKey];
      const shouldShow = !dismissedTime || (Date.now() - dismissedTime) >= 24 * 60 * 60 * 1000;
      if (shouldShow) {
        setShowYearStartPrompt(true);
      }
    }
  };

  const fetchMileageLoggingStyle = async () => {
    try {
      const data = await apiGet<{ mileageLoggingStyle: string }>('/api/user/mileage-logging-style');
      setMileageLoggingStyle(data.mileageLoggingStyle as 'trip_distance' | 'odometer');
    } catch (error) {
      console.error('Error fetching mileage logging style:', error);
    }
  };

  const resetFormData = () => {
    setFormData({
      name: '',
      make: '',
      model: '',
      isPrimary: false,
      usedExclusivelyForBusiness: false,
      claimsCca: false,
      ccaClass: '',
      currentMileage: '',
      totalAnnualMileage: '',
      purchasedThisYear: false,
      purchasePrice: '',
    });
    setEditingVehicle(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a vehicle name');
      return;
    }

    if (formData.claimsCca && !formData.ccaClass) {
      Alert.alert('Error', 'Please select a CCA class when claiming CCA');
      return;
    }

    if (formData.purchasedThisYear && (!formData.purchasePrice || parseFloat(formData.purchasePrice) <= 0)) {
      Alert.alert('Error', 'Please enter a valid purchase price');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        name: formData.name.trim(),
        make: formData.make.trim() || null,
        model: formData.model.trim() || null,
        isPrimary: formData.isPrimary,
        usedExclusivelyForBusiness: formData.usedExclusivelyForBusiness,
        claimsCca: formData.claimsCca,
        ccaClass: formData.claimsCca ? formData.ccaClass : null,
        currentMileage: formData.currentMileage ? parseFloat(formData.currentMileage) : null,
        totalAnnualMileage: formData.totalAnnualMileage ? parseFloat(formData.totalAnnualMileage) : null,
        purchasedThisYear: formData.purchasedThisYear,
        purchasePrice: formData.purchasedThisYear && formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
      };

      if (editingVehicle) {
        await apiRequest('PATCH', `/api/vehicles/${editingVehicle.id}`, payload);
        Alert.alert('Success', 'Vehicle updated successfully');
      } else {
        const response = await apiRequest('POST', '/api/vehicles', payload);
        const newVehicle = await response.json();
        setNewlyCreatedVehicleId(newVehicle.id);
        setShowInitialPhotoPrompt(true);
        Alert.alert('Success', 'Vehicle added successfully');
      }

      setIsModalOpen(false);
      resetFormData();
      await fetchVehicles();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      Alert.alert('Error', 'Failed to save vehicle. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      name: vehicle.name || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      isPrimary: vehicle.isPrimary || false,
      usedExclusivelyForBusiness: vehicle.usedExclusivelyForBusiness || false,
      claimsCca: vehicle.claimsCca || false,
      ccaClass: vehicle.ccaClass || '',
      currentMileage: vehicle.currentMileage ? vehicle.currentMileage.toString() : '',
      totalAnnualMileage: vehicle.totalAnnualMileage ? vehicle.totalAnnualMileage.toString() : '',
      purchasedThisYear: vehicle.purchasedThisYear || false,
      purchasePrice: vehicle.purchasePrice ? vehicle.purchasePrice.toString() : '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete vehicle?',
      'This will permanently remove this vehicle. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteId(id);
              await apiRequest('DELETE', `/api/vehicles/${id}`);
              Alert.alert('Success', 'Vehicle deleted successfully');
              await fetchVehicles();
            } catch (error) {
              console.error('Error deleting vehicle:', error);
              Alert.alert('Error', 'Failed to delete vehicle. Please try again.');
            } finally {
              setDeleteId(null);
            }
          },
        },
      ]
    );
  };

  const updateMileageLoggingStyle = async (style: 'trip_distance' | 'odometer') => {
    try {
      await apiRequest('PATCH', '/api/user/mileage-logging-style', { mileageLoggingStyle: style });
      setMileageLoggingStyle(style);
      setShowMileageStylePicker(false);
      Alert.alert('Success', 'Mileage logging style updated');
    } catch (error) {
      console.error('Error updating mileage logging style:', error);
      Alert.alert('Error', 'Failed to update mileage logging style');
    }
  };

  const renderVehicleItem = ({ item }: { item: Vehicle }) => (
    <View style={[styles.vehicleCard, isDark && styles.vehicleCardDark]}>
      <View style={styles.vehicleCardHeader}>
        <View style={styles.vehicleCardHeaderLeft}>
          <View style={styles.vehicleCardTitleRow}>
            <Text style={[styles.vehicleCardTitle, isDark && styles.vehicleCardTitleDark]}>
              {item.name}
            </Text>
            {item.isPrimary && (
              <View style={[styles.badge, styles.badgePrimary, isDark && styles.badgeDark]}>
                <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>Primary</Text>
              </View>
            )}
            {item.claimsCca && (
              <View style={[styles.badge, isDark && styles.badgeDark]}>
                <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>CCA</Text>
              </View>
            )}
            {item.usedExclusivelyForBusiness && (
              <View style={[styles.badge, styles.badgeBusiness, isDark && styles.badgeDark]}>
                <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>Business Only</Text>
              </View>
            )}
          </View>
          {(item.year || item.make || item.model) && (
            <Text style={[styles.vehicleCardSubtitle, isDark && styles.vehicleCardSubtitleDark]}>
              {[item.year, item.make, item.model].filter(Boolean).join(' ')}
            </Text>
          )}
        </View>
        <View style={styles.vehicleCardActions}>
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/odometer-gallery',
              params: { vehicleId: item.id, vehicleName: item.name || 'Vehicle' }
            })}
            style={styles.vehicleActionButton}
          >
            <MaterialIcons name="photo-library" size={20} color={isDark ? '#9BA1A6' : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={styles.vehicleActionButton}
          >
            <MaterialIcons name="edit" size={20} color={isDark ? '#9BA1A6' : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            disabled={deleteId === item.id}
            style={styles.vehicleActionButton}
          >
            {deleteId === item.id ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <MaterialIcons name="delete" size={20} color={isDark ? '#9BA1A6' : '#666'} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.vehicleCardDetails}>
        {item.currentMileage !== null && item.currentMileage !== undefined && (
          <View style={styles.vehicleDetailRow}>
            <Text style={[styles.vehicleDetailLabel, isDark && styles.vehicleDetailLabelDark]}>
              Starting Mileage:
            </Text>
            <Text style={[styles.vehicleDetailValue, isDark && styles.vehicleDetailValueDark]}>
              {Number(item.currentMileage).toLocaleString()} km
            </Text>
          </View>
        )}
        {item.ccaClass && (
          <View style={styles.vehicleDetailRow}>
            <Text style={[styles.vehicleDetailLabel, isDark && styles.vehicleDetailLabelDark]}>
              CCA Class:
            </Text>
            <Text style={[styles.vehicleDetailValue, isDark && styles.vehicleDetailValueDark]}>
              {item.ccaClass}
            </Text>
          </View>
        )}
        {item.purchasePrice !== null && item.purchasePrice !== undefined && (
          <View style={styles.vehicleDetailRow}>
            <Text style={[styles.vehicleDetailLabel, isDark && styles.vehicleDetailLabelDark]}>
              Purchase Price:
            </Text>
            <Text style={[styles.vehicleDetailValue, isDark && styles.vehicleDetailValueDark]}>
              {formatCurrency(item.purchasePrice)}
            </Text>
          </View>
        )}
        {item.purchasedThisYear && (
          <View style={styles.vehicleDetailRow}>
            <Text style={[styles.vehicleDetailLabel, isDark && styles.vehicleDetailLabelDark]}>
              Purchased: This Year
            </Text>
          </View>
        )}
        {/* Photo Status Display */}
        {(() => {
          const photos = vehiclePhotos[item.id] || [];
          const currentYear = new Date().getFullYear().toString();
          const currentYearStart = `${currentYear}-01-01`;
          const currentYearPhotos = photos.filter((photo: any) => {
            const photoDate = photo.photoDate || photo.readingDate || '';
            return photoDate >= currentYearStart;
          });
          const hasCurrentYearPhotos = currentYearPhotos.length > 0;
          const hasAnyPhotos = photos.length > 0;

          return (
            <View style={styles.vehiclePhotoStatus}>
              <View style={styles.vehiclePhotoStatusRow}>
                <Text style={[styles.vehiclePhotoStatusLabel, isDark && styles.vehiclePhotoStatusLabelDark]}>
                  Odometer Photos:
                </Text>
                <View style={[
                  styles.photoStatusBadge,
                  hasCurrentYearPhotos ? styles.photoStatusBadgeGood : hasAnyPhotos ? styles.photoStatusBadgeWarning : styles.photoStatusBadgeError,
                  isDark && styles.photoStatusBadgeDark
                ]}>
                  <Text style={[
                    styles.photoStatusBadgeText,
                    isDark && styles.photoStatusBadgeTextDark
                  ]}>
                    {hasCurrentYearPhotos 
                      ? `${currentYearPhotos.length} photo${currentYearPhotos.length !== 1 ? 's' : ''} this year`
                      : hasAnyPhotos
                      ? `Needs ${currentYear} photo`
                      : 'No photos'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })()}
      </View>
    </View>
  );

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
            <Text style={[styles.title, isDark && styles.titleDark]}>Vehicles</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Manage your vehicles for expense tracking and CCA claims
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => {
            resetFormData();
            setIsModalOpen(true);
          }}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Mileage Logging Style Setting */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Vehicle Mileage Logging</Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              Choose how you want to log vehicle mileage for all vehicles
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
          onPress={() => setShowMileageStylePicker(true)}
        >
          <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
            {mileageLoggingStyle === 'odometer' ? 'Odometer Reading (Full)' : 'Trip Distance (Simple)'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
        </TouchableOpacity>
        <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
          {mileageLoggingStyle === 'odometer'
            ? 'Enter the actual odometer reading for each entry'
            : 'Enter the distance for each trip. The system calculates cumulative odometer readings automatically.'}
        </Text>
      </View>

      {/* Year-Start Photo Prompt */}
      {showYearStartPrompt && vehiclesNeedingYearStartPhoto.length > 0 && (
        <View style={[styles.alertCard, styles.yearStartAlert, isDark && styles.alertCardDark]}>
          <View style={styles.alertHeader}>
            <MaterialIcons name="info" size={20} color={isDark ? '#60a5fa' : '#2563eb'} />
            <Text style={[styles.alertTitle, isDark && styles.alertTitleDark]}>
              New Tax Year - Upload Odometer Photos
            </Text>
          </View>
          <Text style={[styles.alertDescription, isDark && styles.alertDescriptionDark]}>
            It's a new tax year! Please upload odometer photos for the following vehicles to ensure accurate calculations:
          </Text>
          {vehiclesNeedingYearStartPhoto.map(vehicle => (
            <Text key={vehicle.id} style={[styles.alertVehicleName, isDark && styles.alertVehicleNameDark]}>
              • {vehicle.name}
            </Text>
          ))}
          <View style={styles.alertActions}>
            <TouchableOpacity
              style={[styles.alertButton, styles.alertButtonPrimary]}
              onPress={() => {
                if (vehiclesNeedingYearStartPhoto.length > 0) {
                  const firstVehicle = vehiclesNeedingYearStartPhoto[0];
                  router.push({
                    pathname: '/odometer-gallery',
                    params: { vehicleId: firstVehicle.id, vehicleName: firstVehicle.name || 'Vehicle' }
                  });
                }
              }}
            >
              <Text style={styles.alertButtonText}>Upload Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.alertButton, styles.alertButtonSecondary, isDark && styles.alertButtonSecondaryDark]}
              onPress={async () => {
                const currentYear = new Date().getFullYear().toString();
                const dismissedKey = `yearStartPrompt_${currentYear}`;
                const updated = { ...dismissedReminders, [dismissedKey]: Date.now() };
                setDismissedReminders(updated);
                try {
                  await AsyncStorage.setItem('odometerPhotoReminders', JSON.stringify(updated));
                } catch (e) {
                  console.error('Failed to save dismissed reminder', e);
                }
                setShowYearStartPrompt(false);
              }}
            >
              <Text style={[styles.alertButtonTextSecondary, isDark && styles.alertButtonTextSecondaryDark]}>
                Remind me later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reminder Banners for Vehicles Missing Photos */}
      {vehicles.map((vehicle) => {
        const photos = vehiclePhotos[vehicle.id] || [];
        if (photos.length > 0 || !shouldShowReminder(vehicle.id)) {
          return null;
        }
        return (
          <View key={`reminder-${vehicle.id}`} style={[styles.alertCard, isDark && styles.alertCardDark]}>
            <View style={styles.alertHeader}>
              <MaterialIcons name="warning" size={20} color={isDark ? '#fbbf24' : '#d97706'} />
              <Text style={[styles.alertTitle, isDark && styles.alertTitleDark]}>
                Upload Odometer Photo for {vehicle.name}
              </Text>
            </View>
            <Text style={[styles.alertDescription, isDark && styles.alertDescriptionDark]}>
              Upload a photo of your odometer to help calculate business use percentage accurately.
            </Text>
            <View style={styles.alertActions}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonPrimary]}
                onPress={() => {
                  router.push({
                    pathname: '/odometer-gallery',
                    params: { vehicleId: vehicle.id, vehicleName: vehicle.name || 'Vehicle' }
                  });
                }}
              >
                <Text style={styles.alertButtonText}>Upload Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertDismissButton}
                onPress={() => dismissReminder(vehicle.id)}
              >
                <MaterialIcons name="close" size={20} color={isDark ? '#9BA1A6' : '#666'} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Vehicles List */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Your Vehicles</Text>
          <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
            Manage your vehicles for expense tracking and CCA claims
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} />
        </View>
      ) : vehicles.length === 0 ? (
        <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
          <MaterialIcons name="directions-car" size={48} color={isDark ? '#9BA1A6' : '#666'} />
          <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>
            No vehicles added yet
          </Text>
          <Text style={[styles.emptyStateSubtext, isDark && styles.emptyStateSubtextDark]}>
            Click the + button above to start tracking vehicle-related expenses
          </Text>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          renderItem={renderVehicleItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Mileage Logging Style Picker Modal */}
      <Modal
        visible={showMileageStylePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMileageStylePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowMileageStylePicker(false)}
        >
          <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, isDark && styles.pickerModalTitleDark]}>
                Mileage Logging Style
              </Text>
              <TouchableOpacity onPress={() => setShowMileageStylePicker(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.pickerOption,
                mileageLoggingStyle === 'trip_distance' && styles.pickerOptionSelected,
              ]}
              onPress={() => updateMileageLoggingStyle('trip_distance')}
            >
              <View style={styles.pickerOptionContent}>
                <Text
                  style={[
                    styles.pickerOptionText,
                    isDark && styles.pickerOptionTextDark,
                    mileageLoggingStyle === 'trip_distance' && styles.pickerOptionTextSelected,
                  ]}
                >
                  Trip Distance (Simple)
                </Text>
                <Text style={[styles.pickerOptionDescription, isDark && styles.pickerOptionDescriptionDark]}>
                  Enter the distance for each trip. The system calculates cumulative odometer readings automatically.
                </Text>
              </View>
              {mileageLoggingStyle === 'trip_distance' && (
                <MaterialIcons name="check" size={24} color="#0a7ea4" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pickerOption,
                mileageLoggingStyle === 'odometer' && styles.pickerOptionSelected,
              ]}
              onPress={() => updateMileageLoggingStyle('odometer')}
            >
              <View style={styles.pickerOptionContent}>
                <Text
                  style={[
                    styles.pickerOptionText,
                    isDark && styles.pickerOptionTextDark,
                    mileageLoggingStyle === 'odometer' && styles.pickerOptionTextSelected,
                  ]}
                >
                  Odometer Reading (Full)
                </Text>
                <Text style={[styles.pickerOptionDescription, isDark && styles.pickerOptionDescriptionDark]}>
                  Enter the actual odometer reading for each entry. Readings must be greater than or equal to the previous reading.
                </Text>
              </View>
              {mileageLoggingStyle === 'odometer' && (
                <MaterialIcons name="check" size={24} color="#0a7ea4" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CCA Class Picker Modal */}
      <Modal
        visible={showCcaClassPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCcaClassPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowCcaClassPicker(false)}
        >
          <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
            <ScrollView>
              {['Class 10', 'Class 10.1'].map((className) => (
                <TouchableOpacity
                  key={className}
                  style={[
                    styles.pickerOption,
                    formData.ccaClass === className && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, ccaClass: className });
                    setShowCcaClassPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      isDark && styles.pickerOptionTextDark,
                      formData.ccaClass === className && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {className}
                  </Text>
                  {formData.ccaClass === className && (
                    <MaterialIcons name="check" size={24} color="#0a7ea4" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Initial Photo Upload Prompt Modal */}
      <Modal
        visible={showInitialPhotoPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowInitialPhotoPrompt(false);
          setNewlyCreatedVehicleId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.photoPromptModal, isDark && styles.photoPromptModalDark]}>
            <View style={styles.photoPromptHeader}>
              <Text style={[styles.photoPromptTitle, isDark && styles.photoPromptTitleDark]}>
                Upload Initial Odometer Photo
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowInitialPhotoPrompt(false);
                  setNewlyCreatedVehicleId(null);
                }}
              >
                <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.photoPromptDescription, isDark && styles.photoPromptDescriptionDark]}>
              We recommend uploading a photo of your odometer to help calculate your business use percentage. 
              This photo will document your starting mileage for the tax year.
            </Text>
            <Text style={[styles.photoPromptSubtext, isDark && styles.photoPromptSubtextDark]}>
              You can skip this for now, but we'll remind you to upload a photo later. 
              Photos help ensure accurate tax calculations.
            </Text>
            <View style={styles.photoPromptActions}>
              <TouchableOpacity
                style={[styles.photoPromptButton, styles.photoPromptButtonSecondary, isDark && styles.photoPromptButtonSecondaryDark]}
                onPress={() => {
                  setShowInitialPhotoPrompt(false);
                  setNewlyCreatedVehicleId(null);
                }}
              >
                <Text style={[styles.photoPromptButtonText, isDark && styles.photoPromptButtonTextDark]}>
                  Skip for now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoPromptButton, styles.photoPromptButtonPrimary]}
                onPress={() => {
                  if (newlyCreatedVehicleId) {
                    const vehicle = vehicles.find(v => v.id === newlyCreatedVehicleId);
                    if (vehicle) {
                      setShowInitialPhotoPrompt(false);
                      router.push({
                        pathname: '/odometer-gallery',
                        params: { vehicleId: newlyCreatedVehicleId, vehicleName: vehicle.name || 'Vehicle' }
                      });
                      setNewlyCreatedVehicleId(null);
                    }
                  }
                }}
              >
                <Text style={styles.photoPromptButtonTextPrimary}>Upload Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Vehicle Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={[styles.modalContainer, isDark && styles.modalContainerDark]}>
          <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
            </Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Vehicle Name *</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="e.g., 2019 Honda Civic, Work Truck"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Make</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="Honda"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.make}
                  onChangeText={(text) => setFormData({ ...formData, make: text })}
                />
              </View>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Model</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="Civic"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.model}
                  onChangeText={(text) => setFormData({ ...formData, model: text })}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={[styles.switchContainer, isDark && styles.switchContainerDark]}>
                <View style={styles.switchLabel}>
                  <Text style={[styles.switchLabelText, isDark && styles.switchLabelTextDark]}>
                    Set as Primary Vehicle
                  </Text>
                  <Text style={[styles.switchDescription, isDark && styles.switchDescriptionDark]}>
                    This vehicle will be selected by default when adding vehicle expenses
                  </Text>
                </View>
                <Switch
                  value={formData.isPrimary}
                  onValueChange={(value) => setFormData({ ...formData, isPrimary: value })}
                  trackColor={{ false: '#767577', true: '#0a7ea4' }}
                  thumbColor={formData.isPrimary ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={[styles.switchContainer, isDark && styles.switchContainerDark]}>
                <View style={styles.switchLabel}>
                  <Text style={[styles.switchLabelText, isDark && styles.switchLabelTextDark]}>
                    Business Use Only
                  </Text>
                  <Text style={[styles.switchDescription, isDark && styles.switchDescriptionDark]}>
                    Select if this vehicle is used solely for business (No personal driving)
                  </Text>
                </View>
                <Switch
                  value={formData.usedExclusivelyForBusiness}
                  onValueChange={(value) => setFormData({ ...formData, usedExclusivelyForBusiness: value })}
                  trackColor={{ false: '#767577', true: '#0a7ea4' }}
                  thumbColor={formData.usedExclusivelyForBusiness ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Starting Mileage (km)</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="0"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.currentMileage}
                onChangeText={(text) => setFormData({ ...formData, currentMileage: text })}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                Enter the starting odometer reading in kilometers
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Total Annual Mileage (km)</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="e.g., 25000"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.totalAnnualMileage}
                onChangeText={(text) => setFormData({ ...formData, totalAnnualMileage: text })}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                Enter the total kilometers driven in the tax year
              </Text>
            </View>

            <View style={styles.formGroup}>
              <View style={[styles.switchContainer, isDark && styles.switchContainerDark]}>
                <View style={styles.switchLabel}>
                  <Text style={[styles.switchLabelText, isDark && styles.switchLabelTextDark]}>
                    Did you purchase this vehicle this year?
                  </Text>
                  <Text style={[styles.switchDescription, isDark && styles.switchDescriptionDark]}>
                    Select if you purchased this vehicle in the current tax year
                  </Text>
                </View>
                <Switch
                  value={formData.purchasedThisYear}
                  onValueChange={(value) => setFormData({ ...formData, purchasedThisYear: value })}
                  trackColor={{ false: '#767577', true: '#0a7ea4' }}
                  thumbColor={formData.purchasedThisYear ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {formData.purchasedThisYear && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>Purchase Price *</Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark]}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                  value={formData.purchasePrice}
                  onChangeText={(text) => setFormData({ ...formData, purchasePrice: text })}
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <View style={[styles.switchContainer, isDark && styles.switchContainerDark]}>
                <View style={styles.switchLabel}>
                  <Text style={[styles.switchLabelText, isDark && styles.switchLabelTextDark]}>
                    Claim CCA (Capital Cost Allowance)
                  </Text>
                  <Text style={[styles.switchDescription, isDark && styles.switchDescriptionDark]}>
                    I intend to claim Capital Cost Allowance for this vehicle
                  </Text>
                </View>
                <Switch
                  value={formData.claimsCca}
                  onValueChange={(value) => setFormData({ ...formData, claimsCca: value })}
                  trackColor={{ false: '#767577', true: '#0a7ea4' }}
                  thumbColor={formData.claimsCca ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {formData.claimsCca && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDark && styles.labelDark]}>CCA Class *</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
                  onPress={() => setShowCcaClassPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
                    {formData.ccaClass || 'Select CCA class'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={[styles.modalFooter, isDark && styles.modalFooterDark]}>
            <TouchableOpacity
              style={[styles.cancelButton, isDark && styles.cancelButtonDark]}
              onPress={() => setIsModalOpen(false)}
            >
              <Text style={[styles.cancelButtonText, isDark && styles.cancelButtonTextDark]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
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
    marginBottom: 12,
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
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  helperTextDark: {
    color: '#9BA1A6',
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  vehicleCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vehicleCardHeaderLeft: {
    flex: 1,
  },
  vehicleCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  vehicleCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  vehicleCardTitleDark: {
    color: '#ECEDEE',
  },
  vehicleCardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  vehicleCardSubtitleDark: {
    color: '#9BA1A6',
  },
  vehicleCardDetails: {
    gap: 8,
  },
  vehicleDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  vehicleDetailLabelDark: {
    color: '#9BA1A6',
  },
  vehicleDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#11181C',
  },
  vehicleDetailValueDark: {
    color: '#ECEDEE',
  },
  vehicleCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  vehicleActionButton: {
    padding: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  badgePrimary: {
    backgroundColor: '#dbeafe',
  },
  badgeBusiness: {
    backgroundColor: '#d1fae5',
  },
  badgeDark: {
    backgroundColor: '#374151',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  badgeTextDark: {
    color: '#9BA1A6',
  },
  listContainer: {
    paddingBottom: 16,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyStateDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#11181C',
    textAlign: 'center',
  },
  emptyStateTextDark: {
    color: '#ECEDEE',
  },
  emptyStateSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyStateSubtextDark: {
    color: '#9BA1A6',
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
  },
  pickerModalTitleDark: {
    color: '#ECEDEE',
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
  pickerOptionContent: {
    flex: 1,
    marginRight: 12,
  },
  pickerOptionText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#11181C',
  },
  pickerOptionTextDark: {
    color: '#ECEDEE',
  },
  pickerOptionTextSelected: {
    fontWeight: '600',
    color: '#0a7ea4',
  },
  pickerOptionDescription: {
    fontSize: 12,
    color: '#666',
  },
  pickerOptionDescriptionDark: {
    color: '#9BA1A6',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modalHeaderDark: {
    backgroundColor: '#1f2937',
    borderBottomColor: '#374151',
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
  },
  modalContentContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formGroupHalf: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    color: '#11181C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelDark: {
    color: '#ECEDEE',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#11181C',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
    color: '#ECEDEE',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  switchContainerDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  switchLabelText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#11181C',
  },
  switchLabelTextDark: {
    color: '#ECEDEE',
  },
  switchDescription: {
    fontSize: 12,
    color: '#666',
  },
  switchDescriptionDark: {
    color: '#9BA1A6',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalFooterDark: {
    backgroundColor: '#1f2937',
    borderTopColor: '#374151',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
  },
  cancelButtonTextDark: {
    color: '#ECEDEE',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  alertCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  yearStartAlert: {
    borderColor: '#60a5fa',
    backgroundColor: '#eff6ff',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    flex: 1,
  },
  alertTitleDark: {
    color: '#ECEDEE',
  },
  alertDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  alertDescriptionDark: {
    color: '#9BA1A6',
  },
  alertVehicleName: {
    fontSize: 14,
    color: '#11181C',
    marginLeft: 8,
    marginBottom: 4,
  },
  alertVehicleNameDark: {
    color: '#ECEDEE',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  alertButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonPrimary: {
    backgroundColor: '#0a7ea4',
  },
  alertButtonSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  alertButtonSecondaryDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  alertButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  alertButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
  },
  alertButtonTextSecondaryDark: {
    color: '#ECEDEE',
  },
  alertDismissButton: {
    padding: 8,
    marginLeft: 'auto',
  },
  vehiclePhotoStatus: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  vehiclePhotoStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  vehiclePhotoStatusLabel: {
    fontSize: 14,
    color: '#666',
  },
  vehiclePhotoStatusLabelDark: {
    color: '#9BA1A6',
  },
  photoStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoStatusBadgeGood: {
    backgroundColor: '#d1fae5',
  },
  photoStatusBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  photoStatusBadgeError: {
    backgroundColor: '#fee2e2',
  },
  photoStatusBadgeDark: {
    backgroundColor: '#374151',
  },
  photoStatusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
  },
  photoStatusBadgeTextDark: {
    color: '#9BA1A6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  photoPromptModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  photoPromptModalDark: {
    backgroundColor: '#1f2937',
  },
  photoPromptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoPromptTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#11181C',
    flex: 1,
  },
  photoPromptTitleDark: {
    color: '#ECEDEE',
  },
  photoPromptDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  photoPromptDescriptionDark: {
    color: '#9BA1A6',
  },
  photoPromptSubtext: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
    lineHeight: 18,
  },
  photoPromptSubtextDark: {
    color: '#9BA1A6',
  },
  photoPromptActions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoPromptButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPromptButtonPrimary: {
    backgroundColor: '#0a7ea4',
  },
  photoPromptButtonSecondary: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoPromptButtonSecondaryDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  photoPromptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
  },
  photoPromptButtonTextDark: {
    color: '#ECEDEE',
  },
  photoPromptButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

