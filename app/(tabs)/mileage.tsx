import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiGet, apiRequest } from '@/lib/api';
import { formatDate, getTodayLocalDateString } from '@/lib/format';
import { type Vehicle, type VehicleMileageLog } from '@/lib/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
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

interface MileageLogFormData {
  date: string;
  tripTitle: string;
  odometerReading: string;
  isBusinessUse: boolean;
}

export default function VehicleMileagePage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { taxYear } = useTaxYear();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [mileageLogs, setMileageLogs] = useState<VehicleMileageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [mileageLoggingStyle, setMileageLoggingStyle] = useState<'trip_distance' | 'odometer'>('trip_distance');

  const [formData, setFormData] = useState<MileageLogFormData>({
    date: getTodayLocalDateString(),
    tripTitle: '',
    odometerReading: '',
    isBusinessUse: true,
  });

  useEffect(() => {
    fetchVehicles();
    fetchMileageLoggingStyle();
  }, []);

  useEffect(() => {
    if (selectedVehicleId) {
      fetchMileageLogs();
    }
  }, [selectedVehicleId]);

  // Auto-select first vehicle
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles]);

  const fetchVehicles = async () => {
    try {
      const data = await apiGet<Vehicle[]>('/api/vehicles');
      setVehicles(data);
      if (data.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      Alert.alert('Error', 'Failed to load vehicles');
    } finally {
      setIsLoading(false);
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

  const fetchMileageLogs = async () => {
    if (!selectedVehicleId) return;
    try {
      const data = await apiGet<VehicleMileageLog[]>(`/api/vehicles/${selectedVehicleId}/mileage-logs`);
      setMileageLogs(data);
    } catch (error) {
      console.error('Error fetching mileage logs:', error);
      Alert.alert('Error', 'Failed to load mileage logs');
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const isOdometerStyle = mileageLoggingStyle === 'odometer';

  // Calculate distances and totals
  const sortedLogs = useMemo(() => {
    const sorted = [...mileageLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted.map((log, index) => {
      let distance = 0;
      if (index === 0) {
        const startingMileage = selectedVehicle?.currentMileage ? Number(selectedVehicle.currentMileage) : 0;
        distance = Number(log.odometerReading) - startingMileage;
      } else {
        const prevLog = sorted[index - 1];
        distance = Number(log.odometerReading) - Number(prevLog.odometerReading);
      }
      return { ...log, distance: Math.max(0, distance) };
    });
  }, [mileageLogs, selectedVehicle]);

  const filteredLogs = useMemo(() => {
    return sortedLogs
      .filter((log) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          log.description?.toLowerCase().includes(searchLower) ||
          formatDate(log.date).toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sortedLogs, searchQuery]);

  const totalMileage = sortedLogs.reduce((sum, log) => sum + (log.distance || 0), 0);
  const businessMileage = sortedLogs
    .filter((log) => log.isBusinessUse)
    .reduce((sum, log) => sum + (log.distance || 0), 0);

  const resetFormData = () => {
    setFormData({
      date: getTodayLocalDateString(),
      tripTitle: '',
      odometerReading: '',
      isBusinessUse: true,
    });
    setEditingLogId(null);
  };

  const handleSubmit = async () => {
    if (!selectedVehicleId) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }
    if (!formData.odometerReading || parseFloat(formData.odometerReading) <= 0) {
      Alert.alert('Error', isOdometerStyle ? 'Please enter an odometer reading' : 'Please enter trip distance');
      return;
    }

    try {
      setIsSubmitting(true);
      let odometerReading: number;

      if (isOdometerStyle) {
        odometerReading = parseFloat(formData.odometerReading);
      } else {
        // Trip distance style: calculate cumulative odometer reading
        const tripDistance = parseFloat(formData.odometerReading);
        const lastLog = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1] : null;
        const lastOdometer = lastLog
          ? Number(lastLog.odometerReading)
          : (selectedVehicle?.currentMileage ? Number(selectedVehicle.currentMileage) : 0);
        odometerReading = lastOdometer + tripDistance;
      }

      const payload = {
        date: formData.date,
        odometerReading: odometerReading.toString(),
        description: formData.tripTitle || '',
        isBusinessUse: formData.isBusinessUse,
      };

      if (editingLogId) {
        await apiRequest('PATCH', `/api/mileage-logs/${editingLogId}`, payload);
        Alert.alert('Success', 'Mileage log updated successfully');
      } else {
        await apiRequest('POST', `/api/vehicles/${selectedVehicleId}/mileage-logs`, payload);
        Alert.alert('Success', 'Mileage log added successfully');
      }

      setIsModalOpen(false);
      resetFormData();
      await fetchMileageLogs();
    } catch (error) {
      console.error('Error saving mileage log:', error);
      Alert.alert('Error', 'Failed to save mileage log. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (log: VehicleMileageLog) => {
    setEditingLogId(log.id);
    let readingValue: string;

    if (isOdometerStyle) {
      readingValue = log.odometerReading.toString();
    } else {
      // Calculate trip distance from log and previous log
      const logIndex = sortedLogs.findIndex((l) => l.id === log.id);
      readingValue = (log.distance || 0).toString();
    }

    setFormData({
      date: log.date,
      tripTitle: log.description || '',
      odometerReading: readingValue,
      isBusinessUse: log.isBusinessUse ?? true,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete mileage log?',
      'This will permanently remove this mileage entry. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteId(id);
              await apiRequest('DELETE', `/api/mileage-logs/${id}`);
              Alert.alert('Success', 'Mileage log deleted successfully');
              await fetchMileageLogs();
            } catch (error) {
              console.error('Error deleting mileage log:', error);
              Alert.alert('Error', 'Failed to delete mileage log. Please try again.');
            } finally {
              setDeleteId(null);
            }
          },
        },
      ]
    );
  };

  const renderMileageItem = ({ item }: { item: VehicleMileageLog & { distance?: number } }) => (
    <View style={[styles.mileageCard, isDark && styles.mileageCardDark]}>
      <View style={styles.mileageCardHeader}>
        <View style={styles.mileageCardHeaderLeft}>
          <Text style={[styles.mileageCardTitle, isDark && styles.mileageCardTitleDark]}>
            {item.description || 'Mileage Entry'}
          </Text>
          <Text style={[styles.mileageCardDate, isDark && styles.mileageCardDateDark]}>
            {formatDate(item.date)}
          </Text>
        </View>
        <Text style={styles.mileageCardDistance}>
          {(item.distance || 0).toLocaleString()} km
        </Text>
      </View>
      <View style={styles.mileageCardBody}>
        <View style={styles.mileageCardRow}>
          <View style={[styles.badge, item.isBusinessUse && styles.badgeBusiness, isDark && styles.badgeDark]}>
            <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>
              {item.isBusinessUse ? 'Business' : 'Personal'}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.mileageCardFooter, isDark && styles.mileageCardFooterDark]}>
        <View style={styles.mileageCardActions}>
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={styles.mileageActionButton}
          >
            <MaterialIcons name="edit" size={20} color={isDark ? '#9BA1A6' : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            disabled={deleteId === item.id}
            style={styles.mileageActionButton}
          >
            {deleteId === item.id ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <MaterialIcons name="delete" size={20} color={isDark ? '#9BA1A6' : '#666'} />
            )}
          </TouchableOpacity>
        </View>
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
          <View style={styles.headerText}>
            <Text style={[styles.title, isDark && styles.titleDark]}>Vehicle Mileage</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Track mileage for your vehicles
            </Text>
          </View>
        </View>
      </View>

      {/* Vehicle Selector */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Select Vehicle</Text>
        </View>
        <TouchableOpacity
          style={[styles.pickerButton, isDark && styles.pickerButtonDark]}
          onPress={() => setShowVehiclePicker(true)}
        >
          <Text style={[styles.pickerButtonText, isDark && styles.pickerButtonTextDark]}>
            {selectedVehicle ? selectedVehicle.name : 'Select vehicle'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={24} color={isDark ? '#9BA1A6' : '#666'} />
        </TouchableOpacity>
      </View>

      {selectedVehicleId ? (
        <>
          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>Total Mileage</Text>
              <Text style={[styles.statCardValue, isDark && styles.statCardValueDark]}>
                {totalMileage.toLocaleString()} km
              </Text>
            </View>
            <View style={[styles.statCard, isDark && styles.statCardDark]}>
              <Text style={[styles.statCardTitle, isDark && styles.statCardTitleDark]}>Business Mileage</Text>
              <Text style={[styles.statCardValue, styles.statCardValueGreen, isDark && styles.statCardValueGreenDark]}>
                {businessMileage.toLocaleString()} km
              </Text>
            </View>
          </View>

          {/* Search and Add Button */}
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
                  Mileage Logs - {selectedVehicle?.name}
                </Text>
                <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
                  All recorded mileage entries for this vehicle
                </Text>
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
            <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
              <MaterialIcons name="search" size={18} color={isDark ? '#9BA1A6' : '#666'} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, isDark && styles.searchInputDark]}
                placeholder="Search logs..."
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Mileage Logs List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} />
            </View>
          ) : filteredLogs.length === 0 ? (
            <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
              <MaterialIcons name="directions-car" size={48} color={isDark ? '#9BA1A6' : '#666'} />
              <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>
                {searchQuery ? 'No results match your search' : 'Add your first mileage entry to get started'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredLogs}
              renderItem={renderMileageItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </>
      ) : (
        <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
          <MaterialIcons name="directions-car" size={48} color={isDark ? '#9BA1A6' : '#666'} />
          <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>
            {vehicles.length === 0
              ? 'No vehicles found. Add a vehicle in vehicle settings.'
              : 'Select a vehicle to start tracking mileage'}
          </Text>
        </View>
      )}

      {/* Vehicle Picker Modal */}
      <Modal
        visible={showVehiclePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVehiclePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowVehiclePicker(false)}
        >
          <View style={[styles.pickerModal, isDark && styles.pickerModalDark]}>
            <ScrollView>
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.pickerOption,
                    vehicle.id === selectedVehicleId && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedVehicleId(vehicle.id);
                    setShowVehiclePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      isDark && styles.pickerOptionTextDark,
                      vehicle.id === selectedVehicleId && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {vehicle.name}
                  </Text>
                  {vehicle.id === selectedVehicleId && (
                    <MaterialIcons name="check" size={24} color="#0a7ea4" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add/Edit Mileage Log Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={[styles.modalContainer, isDark && styles.modalContainerDark]}>
          <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              {editingLogId ? 'Edit Mileage Log' : 'Add Mileage Log'}
            </Text>
            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
              <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Trip Title</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="e.g., Trip to location, Client meeting..."
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.tripTitle}
                onChangeText={(text) => setFormData({ ...formData, tripTitle: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Date *</Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.date}
                onChangeText={(text) => setFormData({ ...formData, date: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                {isOdometerStyle ? 'Odometer Reading (km) *' : 'Trip Distance (km) *'}
              </Text>
              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="0.00"
                placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                value={formData.odometerReading}
                onChangeText={(text) => setFormData({ ...formData, odometerReading: text })}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                {isOdometerStyle
                  ? 'Enter the current odometer reading'
                  : 'Enter the distance traveled for this trip'}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <View style={[styles.switchContainer, isDark && styles.switchContainerDark]}>
                <View style={styles.switchLabel}>
                  <Text style={[styles.switchLabelText, isDark && styles.switchLabelTextDark]}>Business Use</Text>
                  <Text style={[styles.switchDescription, isDark && styles.switchDescriptionDark]}>
                    Mark this mileage as business-related
                  </Text>
                </View>
                <Switch
                  value={formData.isBusinessUse}
                  onValueChange={(value) => setFormData({ ...formData, isBusinessUse: value })}
                  trackColor={{ false: '#767577', true: '#0a7ea4' }}
                  thumbColor={formData.isBusinessUse ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
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
                  {editingLogId ? 'Update' : 'Save'}
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
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
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
  statCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statCardTitleDark: {
    color: '#9BA1A6',
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#11181C',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
  },
  searchContainerDark: {
    backgroundColor: 'transparent',
    borderColor: '#4b5563',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#11181C',
  },
  searchInputDark: {
    color: '#ECEDEE',
  },
  mileageCard: {
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
  mileageCardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  mileageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  mileageCardHeaderLeft: {
    flex: 1,
  },
  mileageCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
  },
  mileageCardTitleDark: {
    color: '#ECEDEE',
  },
  mileageCardDate: {
    fontSize: 14,
    color: '#666',
  },
  mileageCardDateDark: {
    color: '#9BA1A6',
  },
  mileageCardDistance: {
    fontSize: 18,
    fontWeight: '700',
    color: '#11181C',
  },
  mileageCardBody: {
    marginBottom: 12,
  },
  mileageCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  badgeBusiness: {
    backgroundColor: '#d1fae5',
  },
  badgeDark: {
    backgroundColor: '#374151',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  badgeTextDark: {
    color: '#9BA1A6',
  },
  mileageCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  mileageCardFooterDark: {
    borderTopColor: '#374151',
  },
  mileageCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  mileageActionButton: {
    padding: 8,
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
    color: '#666',
    textAlign: 'center',
  },
  emptyStateTextDark: {
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
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  helperTextDark: {
    color: '#9BA1A6',
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
});

