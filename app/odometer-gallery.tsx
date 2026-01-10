import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiGet, apiRequest } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { formatDate, getTodayLocalDateString } from '@/lib/format';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OdometerReading {
  id: string;
  filename?: string;
  imageUrl?: string;
  photoUrl?: string;
  readingDate?: string;
  photoDate?: string;
  odometerValue?: number;
  mileage?: number | string;
  vehicleId: string;
  notes?: string;
  uploadedAt?: string;
  [key: string]: any;
}

const { width } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARDS_PER_ROW = 2;
const CARD_SIZE = (width - 32 - CARD_MARGIN * (CARDS_PER_ROW - 1)) / CARDS_PER_ROW;

export default function OdometerGallery() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vehicleId, odometerReadingId, vehicleName: vehicleNameParam } = useLocalSearchParams<{ vehicleId?: string; odometerReadingId?: string; vehicleName?: string }>();

  const [readings, setReadings] = useState<OdometerReading[]>([]);
  const [vehicleName, setVehicleName] = useState<string>(vehicleNameParam || 'Vehicle');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReading, setSelectedReading] = useState<OdometerReading | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDate, setUploadDate] = useState<string>(getTodayLocalDateString());
  const [uploadMileage, setUploadMileage] = useState<string>('');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [editPhotoDate, setEditPhotoDate] = useState<string>('');
  const [editPhotoMileage, setEditPhotoMileage] = useState<string>('');
  const [editPhotoNotes, setEditPhotoNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Get current tax year
  const currentYear = new Date().getFullYear().toString();
  const currentYearStart = `${currentYear}-01-01`;

  // Calculate photo status
  const currentYearPhotos = readings.filter(reading => {
    const photoDate = reading.photoDate || reading.readingDate || '';
    return photoDate >= currentYearStart;
  });
  const hasCurrentYearPhotos = currentYearPhotos.length > 0;
  const hasAnyPhotos = readings.length > 0;

  useEffect(() => {
    if (vehicleId) {
      fetchReadings();
      // Try to fetch vehicle name, but don't fail if endpoint doesn't exist
      if (!vehicleNameParam) {
        fetchVehicleName();
      }
    }
  }, [vehicleId]);

  // Auto-open reading if odometerReadingId is provided
  useEffect(() => {
    if (odometerReadingId && readings.length > 0 && !isLoading) {
      const reading = readings.find((r) => r.id === odometerReadingId);
      if (reading) {
        setSelectedReading(reading);
        setIsImageModalOpen(true);
      }
    }
  }, [odometerReadingId, readings, isLoading]);

  const fetchVehicleName = async () => {
    if (!vehicleId) return;
    try {
      // Try to get vehicle from the list endpoint instead
      const vehicles = await apiGet<any[]>('/api/vehicles');
      const vehicle = vehicles?.find((v) => v.id === vehicleId);
      if (vehicle?.name) {
        setVehicleName(vehicle.name);
      }
    } catch (error) {
      // Silently fail - we'll just use "Vehicle" as default
      console.error('Error fetching vehicle name:', error);
    }
  };

  const fetchReadings = async () => {
    if (!vehicleId) return;
    try {
      setIsLoading(true);
      const data = await apiGet<OdometerReading[]>(`/api/vehicles/${vehicleId}/odometer-photos`);
      if (__DEV__) {
        console.log('Fetched odometer photos:', data);
      }
      setReadings(data || []);
    } catch (error: any) {
      // Silently handle 404 - endpoint may not exist yet
      if (error.message?.includes('404')) {
        if (__DEV__) {
          console.log('Odometer photos endpoint not found (404) - showing empty state');
        }
        setReadings([]);
      } else {
        console.error('Error fetching odometer photos:', error);
        // Only show alert for non-404 errors
        Alert.alert('Error', 'Failed to load odometer photos. Please try again.');
        setReadings([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const uploadOdometerImage = async (uri: string) => {
    if (!vehicleId) {
      Alert.alert('Error', 'Vehicle ID is missing');
      return;
    }

    if (!uploadDate) {
      Alert.alert('Error', 'Please enter a reading date');
      return;
    }

    // Validate mileage is required and > 0
    const mileageValue = parseFloat(uploadMileage);
    if (!uploadMileage || uploadMileage.trim() === '' || isNaN(mileageValue) || mileageValue <= 0) {
      Alert.alert('Error', 'Please enter a valid odometer reading (must be greater than 0)');
      return;
    }

    const fullUrl = `${API_URL}/api/vehicles/${vehicleId}/odometer-photos`;
    
    if (__DEV__) {
      console.log(`Uploading odometer photo: ${fullUrl}`);
    }
    
    try {
      setIsUploading(true);
      const formData = new FormData();
      
      const filename = uri.split('/').pop() || 'odometer.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      // @ts-ignore - FormData append types are complex in React Native
      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);
      
      // Backend expects photoDate (not readingDate)
      if (uploadDate) {
        formData.append('photoDate', uploadDate);
      }
      // Add required mileage field
      formData.append('mileage', uploadMileage);
      if (uploadNotes) {
        formData.append('notes', uploadNotes);
      }

      const res = await fetch(fullUrl, {
        method: 'POST',
        // Don't set Content-Type header - let React Native set it automatically for FormData
        headers: {},
        body: formData,
        credentials: 'include',
      });

      if (res.status === 401) {
        throw new Error('Unauthorized');
      }

      if (!res.ok) {
        const text = await res.text();
        // Handle 404 gracefully if endpoint doesn't exist
        if (res.status === 404) {
          throw new Error('Upload endpoint not available. Please ensure the backend API is implemented.');
        }
        throw new Error(`${res.status}: ${text}`);
      }

      const result = await res.json();
      
      await fetchReadings();
      setIsUploadModalOpen(false);
      setUploadDate(getTodayLocalDateString());
      setUploadMileage('');
      setUploadNotes('');
      setPendingPhotoUri(null);
      Alert.alert('Success', 'Odometer photo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading odometer reading:', error);
      
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        Alert.alert(
          'Connection Error',
          `Cannot connect to backend at ${fullUrl}. Please ensure the backend is running and the endpoint is implemented.`
        );
      } else {
        Alert.alert('Upload Error', error.message || 'Failed to upload odometer reading. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Reduced quality for smaller file size (odometer photos just need readable numbers)
        // Note: EXIF data is preserved for backend date extraction
      });

      if (!result.canceled && result.assets[0]) {
        setPendingPhotoUri(result.assets[0].uri);
        // Don't upload immediately - wait for user to enter mileage
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Photo library permission is required to select photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // Reduced quality for smaller file size (odometer photos just need readable numbers)
        // Note: EXIF data is preserved for backend date extraction
      });

      if (!result.canceled && result.assets[0]) {
        setPendingPhotoUri(result.assets[0].uri);
        // Don't upload immediately - wait for user to enter mileage
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handleUploadWithMileage = async () => {
    if (!pendingPhotoUri) {
      Alert.alert('Error', 'No photo selected');
      return;
    }

    const mileageValue = parseFloat(uploadMileage);
    if (!uploadMileage || uploadMileage.trim() === '' || isNaN(mileageValue) || mileageValue <= 0) {
      Alert.alert('Error', 'Please enter a valid odometer reading (must be greater than 0)');
      return;
    }

    await uploadOdometerImage(pendingPhotoUri);
  };

  const handleAddPress = () => {
    setUploadDate(getTodayLocalDateString());
    setUploadMileage('');
    setUploadNotes('');
    setPendingPhotoUri(null);
    setIsUploadModalOpen(true);
  };

  const handleDelete = async (reading: OdometerReading) => {
    Alert.alert(
      'Delete Odometer Photo?',
      'This will permanently remove this odometer photo. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteId(reading.id);
              await apiRequest('DELETE', `/api/vehicles/${vehicleId}/odometer-photos/${reading.id}`);
              await fetchReadings();
              if (selectedReading?.id === reading.id) {
                setSelectedReading(null);
                setIsImageModalOpen(false);
              }
              Alert.alert('Success', 'Odometer photo deleted successfully');
            } catch (error) {
              console.error('Error deleting odometer photo:', error);
              Alert.alert('Error', 'Failed to delete odometer photo. Please try again.');
            } finally {
              setDeleteId(null);
            }
          },
        },
      ]
    );
  };

  const getImageUrl = (reading: OdometerReading) => {
    const url = reading.imageUrl || reading.photoUrl || '';
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const openImageModal = (reading: OdometerReading) => {
    setSelectedReading(reading);
    setIsImageModalOpen(true);
    setIsEditingPhoto(false);
    // Initialize edit values
    const photoDate = reading.photoDate || reading.readingDate || '';
    setEditPhotoDate(photoDate);
    setEditPhotoMileage((reading.mileage || reading.odometerValue || '').toString());
    setEditPhotoNotes(reading.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!selectedReading || !vehicleId) return;

    // Validate mileage
    const mileageValue = parseFloat(editPhotoMileage);
    if (!editPhotoMileage || editPhotoMileage.trim() === '' || isNaN(mileageValue) || mileageValue <= 0) {
      Alert.alert('Error', 'Please enter a valid odometer reading (must be greater than 0)');
      return;
    }

    // Validate date
    if (!editPhotoDate || editPhotoDate.trim() === '') {
      Alert.alert('Error', 'Please enter a valid date');
      return;
    }

    try {
      setIsSavingEdit(true);
      await apiRequest('PATCH', `/api/vehicles/${vehicleId}/odometer-photos/${selectedReading.id}`, {
        photoDate: editPhotoDate,
        mileage: editPhotoMileage,
        notes: editPhotoNotes || null,
      });
      
      await fetchReadings();
      setIsEditingPhoto(false);
      Alert.alert('Success', 'Photo updated successfully');
    } catch (error: any) {
      console.error('Error updating photo:', error);
      Alert.alert('Error', error.message || 'Failed to update photo. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingPhoto(false);
    // Reset to original values
    if (selectedReading) {
      const photoDate = selectedReading.photoDate || selectedReading.readingDate || '';
      setEditPhotoDate(photoDate);
      setEditPhotoMileage((selectedReading.mileage || selectedReading.odometerValue || '').toString());
      setEditPhotoNotes(selectedReading.notes || '');
    }
  };

  const renderReadingCard = ({ item }: { item: OdometerReading }) => {
    const isPressed = pressedCardId === item.id;

    return (
      <View style={styles.readingCardWrapper}>
        <TouchableOpacity
          style={[styles.readingCard, isDark && styles.readingCardDark]}
          onPress={() => openImageModal(item)}
          onPressIn={() => setPressedCardId(item.id)}
          onPressOut={() => setPressedCardId(null)}
          activeOpacity={0.9}
        >
          <View style={[styles.readingImageContainer, isDark && styles.readingImageContainerDark]}>
            <Image
              source={{ uri: getImageUrl(item) }}
              style={styles.readingImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('Error loading odometer image:', error.nativeEvent.error, 'URL:', getImageUrl(item));
              }}
            />
            <View
              style={[
                styles.readingOverlay,
                isDark && styles.readingOverlayDark,
                isPressed && styles.readingOverlayVisible,
              ]}
            >
              <TouchableOpacity
                style={[styles.readingActionButton, isDark && styles.readingActionButtonDark]}
                onPress={(e) => {
                  e.stopPropagation();
                  setPressedCardId(null);
                  openImageModal(item);
                }}
              >
                <MaterialIcons name="zoom-in" size={16} color={isDark ? '#ECEDEE' : '#11181C'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.readingActionButton, styles.readingDeleteButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  setPressedCardId(null);
                  handleDelete(item);
                }}
                disabled={deleteId === item.id}
              >
                {deleteId === item.id ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <MaterialIcons name="delete" size={16} color="#ef4444" />
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.readingCardInfo}>
            {(item.readingDate || item.photoDate) && (
              <Text style={[styles.readingDate, isDark && styles.readingDateDark]}>
                {formatDate(item.photoDate || item.readingDate || '')}
              </Text>
            )}
            {(item.mileage || item.odometerValue) && (
              <Text style={[styles.readingMileage, isDark && styles.readingMileageDark]}>
                {Number(item.mileage || item.odometerValue).toLocaleString('en-CA', { maximumFractionDigits: 0 })} km
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (!vehicleId) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
          </TouchableOpacity>
          <Text style={[styles.title, isDark && styles.titleDark]}>Odometer Gallery</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>
            Vehicle ID not provided
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, isDark && styles.titleDark]}>Odometer Gallery</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                {vehicleName || 'Vehicle'} • {readings?.length || 0} reading{(readings?.length || 0) !== 1 ? 's' : ''}
              </Text>
              {hasAnyPhotos && (
                <View style={[
                  styles.statusBadge,
                  hasCurrentYearPhotos ? styles.statusBadgeGood : styles.statusBadgeWarning,
                  isDark && styles.statusBadgeDark
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    isDark && styles.statusBadgeTextDark
                  ]}>
                    {hasCurrentYearPhotos 
                      ? `${currentYearPhotos.length} photo${currentYearPhotos.length !== 1 ? 's' : ''} this year`
                      : `Needs ${currentYear} photo`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddPress}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} />
        </View>
      ) : readings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyStateIcon, isDark && styles.emptyStateIconDark]}>
            <MaterialIcons name="speed" size={32} color={isDark ? '#9BA1A6' : '#666'} />
          </View>
          <Text style={[styles.emptyStateTitle, isDark && styles.emptyStateTitleDark]}>
            No odometer readings uploaded
          </Text>
          <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>
            Upload photos of your odometer readings to track mileage over time
          </Text>
        </View>
      ) : (
        <FlatList
          data={readings.sort((a, b) => {
            const dateA = new Date(b.photoDate || b.readingDate || '').getTime();
            const dateB = new Date(a.photoDate || a.readingDate || '').getTime();
            return dateA - dateB;
          })}
          renderItem={renderReadingCard}
          keyExtractor={(item) => item.id}
          numColumns={CARDS_PER_ROW}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Upload Modal */}
      <Modal
        visible={isUploadModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsUploadModalOpen(false)}
      >
        <View style={[styles.modalContainer, isDark && styles.modalContainerDark]}>
          <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
              Upload Odometer Reading
            </Text>
            <TouchableOpacity onPress={() => setIsUploadModalOpen(false)}>
              <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {!pendingPhotoUri ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Photo Date</Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
                    placeholder="YYYY-MM-DD (optional - will use EXIF or today's date)"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={uploadDate}
                    onChangeText={setUploadDate}
                  />
                  <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                    Optional: Leave empty to use photo EXIF date or today's date
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>
                    Odometer Reading <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
                    placeholder="Enter mileage shown in photo"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={uploadMileage}
                    onChangeText={setUploadMileage}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                    <Text style={{ fontWeight: '600' }}>Required for tax calculations.</Text> Enter the odometer reading displayed in this photo. This is used to calculate your total annual mileage and business use percentage.
                  </Text>
                  {uploadMileage && parseFloat(uploadMileage) <= 0 && (
                    <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
                      Please enter a valid mileage reading greater than 0.
                    </Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, isDark && styles.inputDark]}
                    placeholder="Optional notes..."
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={uploadNotes}
                    onChangeText={setUploadNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.uploadButtons}>
                  <TouchableOpacity
                    style={[styles.uploadButton, isDark && styles.uploadButtonDark]}
                    onPress={handleTakePhoto}
                    disabled={isUploading}
                  >
                    <MaterialIcons name="camera-alt" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
                    <Text style={[styles.uploadButtonText, isDark && styles.uploadButtonTextDark]}>
                      Take Photo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.uploadButton, isDark && styles.uploadButtonDark]}
                    onPress={handlePickImage}
                    disabled={isUploading}
                  >
                    <MaterialIcons name="photo-library" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
                    <Text style={[styles.uploadButtonText, isDark && styles.uploadButtonTextDark]}>
                      Choose from Gallery
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Photo Selected</Text>
                  <View style={[styles.selectedPhotoPreview, isDark && styles.selectedPhotoPreviewDark]}>
                    <Image
                      source={{ uri: pendingPhotoUri }}
                      style={styles.selectedPhotoImage}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => setPendingPhotoUri(null)}
                    >
                      <MaterialIcons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Photo Date</Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={uploadDate}
                    onChangeText={setUploadDate}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>
                    Odometer Reading <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, isDark && styles.inputDark]}
                    placeholder="Enter mileage shown in photo"
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={uploadMileage}
                    onChangeText={setUploadMileage}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                    <Text style={{ fontWeight: '600' }}>Required for tax calculations.</Text> Enter the odometer reading displayed in this photo.
                  </Text>
                  {uploadMileage && parseFloat(uploadMileage) <= 0 && (
                    <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
                      Please enter a valid mileage reading greater than 0.
                    </Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, isDark && styles.inputDark]}
                    placeholder="Optional notes..."
                    placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                    value={uploadNotes}
                    onChangeText={setUploadNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.uploadConfirmButton,
                    (!uploadMileage || parseFloat(uploadMileage) <= 0) && styles.uploadConfirmButtonDisabled,
                    isDark && styles.uploadConfirmButtonDark,
                  ]}
                  onPress={handleUploadWithMileage}
                  disabled={isUploading || !uploadMileage || parseFloat(uploadMileage) <= 0}
                >
                  {isUploading ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.uploadConfirmButtonText}>Uploading...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="cloud-upload" size={24} color="#fff" />
                      <Text style={styles.uploadConfirmButtonText}>Upload Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={isImageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (isEditingPhoto) {
            handleCancelEdit();
          }
          setIsImageModalOpen(false);
        }}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalBackdrop}
            activeOpacity={1}
            onPress={() => setIsImageModalOpen(false)}
          >
            <View style={styles.imageModalContent}>
              {selectedReading && (
                <>
                  <View style={[styles.imageModalHeader, { paddingTop: insets.top + 16 }]}>
                    <View style={styles.imageModalHeaderInfo}>
                      {isEditingPhoto ? (
                        <>
                          <View style={styles.imageModalEditField}>
                            <Text style={[styles.imageModalEditLabel, isDark && styles.imageModalEditLabelDark]}>
                              Photo Date
                            </Text>
                            <TextInput
                              style={[styles.imageModalEditInput, isDark && styles.imageModalEditInputDark]}
                              value={editPhotoDate}
                              onChangeText={setEditPhotoDate}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                            />
                          </View>
                          <View style={styles.imageModalEditField}>
                            <Text style={[styles.imageModalEditLabel, isDark && styles.imageModalEditLabelDark]}>
                              Odometer Reading <Text style={{ color: '#ef4444' }}>*</Text>
                            </Text>
                            <TextInput
                              style={[styles.imageModalEditInput, isDark && styles.imageModalEditInputDark]}
                              value={editPhotoMileage}
                              onChangeText={setEditPhotoMileage}
                              placeholder="Enter mileage"
                              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={styles.imageModalEditField}>
                            <Text style={[styles.imageModalEditLabel, isDark && styles.imageModalEditLabelDark]}>
                              Notes
                            </Text>
                            <TextInput
                              style={[styles.imageModalEditInput, styles.imageModalEditTextArea, isDark && styles.imageModalEditInputDark]}
                              value={editPhotoNotes}
                              onChangeText={setEditPhotoNotes}
                              placeholder="Optional notes..."
                              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                              multiline
                              numberOfLines={2}
                            />
                          </View>
                        </>
                      ) : (
                        <>
                          {(selectedReading.photoDate || selectedReading.readingDate) && (
                            <Text style={[styles.imageModalTitle, isDark && styles.imageModalTitleDark]}>
                              {formatDate(selectedReading.photoDate || selectedReading.readingDate || '')}
                            </Text>
                          )}
                          {(selectedReading.mileage || selectedReading.odometerValue) && (
                            <Text style={[styles.imageModalMileage, isDark && styles.imageModalMileageDark]}>
                              {Number(selectedReading.mileage || selectedReading.odometerValue).toLocaleString('en-CA', { maximumFractionDigits: 0 })} km
                            </Text>
                          )}
                          {selectedReading.notes && (
                            <Text style={[styles.imageModalNotes, isDark && styles.imageModalNotesDark]}>
                              {selectedReading.notes}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                    <View style={styles.imageModalHeaderActions}>
                      {!isEditingPhoto && (
                        <TouchableOpacity
                          onPress={() => setIsEditingPhoto(true)}
                          style={styles.imageModalEditButton}
                        >
                          <MaterialIcons name="edit" size={20} color={isDark ? '#ECEDEE' : '#11181C'} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          if (isEditingPhoto) {
                            handleCancelEdit();
                          }
                          setIsImageModalOpen(false);
                        }}
                        style={styles.imageModalCloseButton}
                      >
                        <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <ScrollView
                    style={styles.imageModalScrollView}
                    contentContainerStyle={styles.imageModalScrollContent}
                    maximumZoomScale={3}
                    minimumZoomScale={1}
                  >
                    <Image
                      source={{ uri: getImageUrl(selectedReading) }}
                      style={styles.imageModalImage}
                      resizeMode="contain"
                      onError={(error) => {
                        console.error('Error loading odometer image in modal:', error.nativeEvent.error);
                      }}
                    />
                  </ScrollView>
                  <View style={[styles.imageModalFooter, isDark && styles.imageModalFooterDark]}>
                    {isEditingPhoto ? (
                      <View style={styles.imageModalEditActions}>
                        <TouchableOpacity
                          style={[styles.imageModalCancelButton, isDark && styles.imageModalCancelButtonDark]}
                          onPress={handleCancelEdit}
                          disabled={isSavingEdit}
                        >
                          <Text style={[styles.imageModalCancelButtonText, isDark && styles.imageModalCancelButtonTextDark]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.imageModalSaveButton, isSavingEdit && styles.imageModalSaveButtonDisabled]}
                          onPress={handleSaveEdit}
                          disabled={isSavingEdit}
                        >
                          {isSavingEdit ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <MaterialIcons name="check" size={20} color="#fff" />
                              <Text style={styles.imageModalSaveButtonText}>Save</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.imageModalDeleteButton, isDark && styles.imageModalDeleteButtonDark]}
                        onPress={() => {
                          if (selectedReading) {
                            handleDelete(selectedReading);
                          }
                        }}
                        disabled={deleteId === selectedReading.id}
                      >
                        {deleteId === selectedReading.id ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <>
                            <MaterialIcons name="delete" size={20} color="#ef4444" />
                            <Text style={styles.imageModalDeleteText}>Delete</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
  },
  statusBadgeGood: {
    backgroundColor: '#d1fae5',
  },
  statusBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeDark: {
    backgroundColor: '#374151',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
  },
  statusBadgeTextDark: {
    color: '#9BA1A6',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateIconDark: {
    backgroundColor: '#374151',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
    color: '#11181C',
  },
  emptyStateTitleDark: {
    color: '#ECEDEE',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyStateTextDark: {
    color: '#9BA1A6',
  },
  listContent: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  readingCardWrapper: {
    width: CARD_SIZE,
    marginBottom: CARD_MARGIN,
  },
  readingCard: {
    width: '100%',
  },
  readingCardDark: {
    // No special styling needed
  },
  readingImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  readingImageContainerDark: {
    backgroundColor: '#374151',
  },
  readingImage: {
    width: '100%',
    height: '100%',
  },
  readingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    opacity: 0,
  },
  readingOverlayVisible: {
    opacity: 1,
  },
  readingOverlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  readingActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  readingActionButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  readingDeleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  readingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 2,
  },
  readingValueDark: {
    color: '#ECEDEE',
  },
  readingCardInfo: {
    marginTop: 4,
  },
  readingDate: {
    fontSize: 12,
    color: '#666',
  },
  readingDateDark: {
    color: '#9BA1A6',
  },
  readingMileage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#11181C',
    marginTop: 2,
  },
  readingMileageDark: {
    color: '#ECEDEE',
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modalHeaderDark: {
    backgroundColor: '#151718',
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#11181C',
    letterSpacing: -0.5,
  },
  modalTitleDark: {
    color: '#ECEDEE',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelDark: {
    color: '#9BA1A6',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#11181C',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  inputDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
    color: '#ECEDEE',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  helperTextDark: {
    color: '#9BA1A6',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
  },
  errorTextDark: {
    color: '#f87171',
  },
  selectedPhotoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    position: 'relative',
    marginTop: 8,
  },
  selectedPhotoPreviewDark: {
    backgroundColor: '#374151',
  },
  selectedPhotoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#0a7ea4',
    marginTop: 8,
  },
  uploadConfirmButtonDark: {
    backgroundColor: '#0a7ea4',
  },
  uploadConfirmButtonDisabled: {
    opacity: 0.5,
  },
  uploadConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  uploadButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
  },
  uploadButtonTextDark: {
    color: '#ECEDEE',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  uploadingText: {
    fontSize: 14,
    color: '#666',
  },
  uploadingTextDark: {
    color: '#9BA1A6',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  imageModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  imageModalHeaderInfo: {
    flex: 1,
    marginRight: 12,
  },
  imageModalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageModalEditButton: {
    padding: 8,
  },
  imageModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ECEDEE',
    marginBottom: 4,
  },
  imageModalTitleDark: {
    color: '#ECEDEE',
  },
  imageModalDate: {
    fontSize: 14,
    color: '#9BA1A6',
    marginBottom: 4,
  },
  imageModalDateDark: {
    color: '#9BA1A6',
  },
  imageModalMileage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ECEDEE',
    marginTop: 4,
  },
  imageModalMileageDark: {
    color: '#ECEDEE',
  },
  imageModalNotes: {
    fontSize: 14,
    color: '#9BA1A6',
    marginTop: 4,
  },
  imageModalNotesDark: {
    color: '#9BA1A6',
  },
  imageModalCloseButton: {
    padding: 8,
  },
  imageModalScrollView: {
    flex: 1,
  },
  imageModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: width,
    height: '100%',
  },
  imageModalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  imageModalFooterDark: {
    borderTopColor: '#374151',
  },
  imageModalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  imageModalDeleteButtonDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  imageModalDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  imageModalEditField: {
    marginBottom: 12,
  },
  imageModalEditLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9BA1A6',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageModalEditLabelDark: {
    color: '#9BA1A6',
  },
  imageModalEditInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#ECEDEE',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageModalEditInputDark: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ECEDEE',
  },
  imageModalEditTextArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  imageModalEditActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  imageModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalCancelButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  imageModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ECEDEE',
  },
  imageModalCancelButtonTextDark: {
    color: '#ECEDEE',
  },
  imageModalSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0a7ea4',
  },
  imageModalSaveButtonDisabled: {
    opacity: 0.6,
  },
  imageModalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

