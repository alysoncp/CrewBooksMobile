import { useTaxYear } from '@/contexts/TaxYearContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiGet, apiRequest } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { formatDate } from '@/lib/format';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Receipt {
  id: string;
  filename: string;
  imageUrl: string;
  uploadedAt: string;
  expenseId?: string;
  notes?: string;
  [key: string]: any;
}

const { width } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARDS_PER_ROW = 2;
const CARD_SIZE = (width - 32 - CARD_MARGIN * (CARDS_PER_ROW - 1)) / CARDS_PER_ROW;

export default function ReceiptGallery() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { taxYear } = useTaxYear();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLinkedExpense, setDeleteLinkedExpense] = useState(false);
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipts();
  }, [taxYear]);

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet<Receipt[]>('/api/receipts');
      if (__DEV__) {
        console.log('Fetched receipts:', data);
        if (data && data.length > 0) {
          console.log('First receipt imageUrl:', data[0].imageUrl);
        }
      }
      setReceipts(data || []);
    } catch (error: any) {
      console.error('Error fetching receipts:', error);
      if (!error.message?.includes('404')) {
        Alert.alert('Error', 'Failed to load receipts. Please try again.');
      }
      setReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (receipt: Receipt) => {
    const linkedExpense = !!receipt.expenseId;
    setDeleteLinkedExpense(false);

    const alertMessage = linkedExpense
      ? `This will permanently remove this receipt image. This action cannot be undone.\n\nThis receipt is linked to an expense entry.`
      : 'This will permanently remove this receipt image. This action cannot be undone.';

    Alert.alert(
      'Delete Receipt?',
      alertMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (linkedExpense) {
              Alert.alert(
                'Delete Linked Expense?',
                'Would you also like to delete the linked expense entry?',
                [
                  {
                    text: 'No, keep expense entry',
                    style: 'cancel',
                    onPress: () => handleDeleteConfirm(receipt, false),
                  },
                  {
                    text: 'Yes, delete both',
                    style: 'destructive',
                    onPress: () => handleDeleteConfirm(receipt, true),
                  },
                ]
              );
            } else {
              handleDeleteConfirm(receipt, false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteConfirm = async (receipt: Receipt, deleteLinked: boolean) => {
    try {
      setDeleteId(receipt.id);
      const payload = deleteLinked ? { deleteLinked: true } : undefined;
      await apiRequest('DELETE', `/api/receipts/${receipt.id}`, payload);
      await fetchReceipts();
      if (selectedReceipt?.id === receipt.id) {
        setSelectedReceipt(null);
        setIsImageModalOpen(false);
      }
      Alert.alert('Success', 'Receipt deleted successfully');
    } catch (error) {
      console.error('Error deleting receipt:', error);
      Alert.alert('Error', 'Failed to delete receipt. Please try again.');
    } finally {
      setDeleteId(null);
      setDeleteLinkedExpense(false);
    }
  };

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `${API_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  };

  const openImageModal = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setIsImageModalOpen(true);
  };

  const renderReceiptCard = ({ item }: { item: Receipt }) => {
    const isPressed = pressedCardId === item.id;

    return (
      <View style={styles.receiptCardWrapper}>
        <TouchableOpacity
          style={[styles.receiptCard, isDark && styles.receiptCardDark]}
          onPress={() => openImageModal(item)}
          onPressIn={() => setPressedCardId(item.id)}
          onPressOut={() => setPressedCardId(null)}
          activeOpacity={0.9}
        >
          <View style={[styles.receiptImageContainer, isDark && styles.receiptImageContainerDark]}>
            <Image
              source={{ uri: getImageUrl(item.imageUrl) }}
              style={styles.receiptImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('Error loading receipt image:', error.nativeEvent.error, 'URL:', getImageUrl(item.imageUrl));
              }}
            />
            <View
              style={[
                styles.receiptOverlay,
                isDark && styles.receiptOverlayDark,
                isPressed && styles.receiptOverlayVisible,
              ]}
            >
              <TouchableOpacity
                style={[styles.receiptActionButton, isDark && styles.receiptActionButtonDark]}
                onPress={(e) => {
                  e.stopPropagation();
                  setPressedCardId(null);
                  openImageModal(item);
                }}
              >
                <MaterialIcons name="zoom-in" size={16} color={isDark ? '#ECEDEE' : '#11181C'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.receiptActionButton, styles.receiptDeleteButton]}
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
          {item.notes && (
            <Text
              style={[styles.receiptNotes, isDark && styles.receiptNotesDark]}
              numberOfLines={1}
            >
              {item.notes}
            </Text>
          )}
          {item.uploadedAt && (
            <Text style={[styles.receiptDate, isDark && styles.receiptDateDark]}>
              {formatDate(item.uploadedAt)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, isDark && styles.titleDark]}>Receipt Gallery</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              {receipts?.length || 0} receipt{(receipts?.length || 0) !== 1 ? 's' : ''} uploaded
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} />
        </View>
      ) : receipts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyStateIcon, isDark && styles.emptyStateIconDark]}>
            <MaterialIcons name="description" size={32} color={isDark ? '#9BA1A6' : '#666'} />
          </View>
          <Text style={[styles.emptyStateTitle, isDark && styles.emptyStateTitleDark]}>
            No receipts uploaded
          </Text>
          <Text style={[styles.emptyStateText, isDark && styles.emptyStateTextDark]}>
            Upload photos of your receipts to keep them organized
          </Text>
        </View>
      ) : (
        <FlatList
          data={receipts}
          renderItem={renderReceiptCard}
          keyExtractor={(item) => item.id}
          numColumns={CARDS_PER_ROW}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Image Modal */}
      <Modal
        visible={isImageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImageModalOpen(false)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity
            style={styles.imageModalBackdrop}
            activeOpacity={1}
            onPress={() => setIsImageModalOpen(false)}
          >
            <View style={styles.imageModalContent}>
              {selectedReceipt && (
                <>
                  <View style={[styles.imageModalHeader, { paddingTop: insets.top + 16 }]}>
                    <View style={styles.imageModalHeaderInfo}>
                      {selectedReceipt.notes && (
                        <Text style={[styles.imageModalTitle, isDark && styles.imageModalTitleDark]}>
                          {selectedReceipt.notes}
                        </Text>
                      )}
                      {selectedReceipt.uploadedAt && (
                        <Text style={[styles.imageModalDate, isDark && styles.imageModalDateDark]}>
                          {formatDate(selectedReceipt.uploadedAt)}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsImageModalOpen(false)}
                      style={styles.imageModalCloseButton}
                    >
                      <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    style={styles.imageModalScrollView}
                    contentContainerStyle={styles.imageModalScrollContent}
                    maximumZoomScale={3}
                    minimumZoomScale={1}
                  >
                    <Image
                      source={{ uri: getImageUrl(selectedReceipt.imageUrl) }}
                      style={styles.imageModalImage}
                      resizeMode="contain"
                      onError={(error) => {
                        console.error('Error loading receipt image in modal:', error.nativeEvent.error, 'URL:', getImageUrl(selectedReceipt.imageUrl));
                      }}
                    />
                  </ScrollView>
                  <View style={[styles.imageModalFooter, isDark && styles.imageModalFooterDark]}>
                    <TouchableOpacity
                      style={[styles.imageModalDeleteButton, isDark && styles.imageModalDeleteButtonDark]}
                      onPress={() => {
                        if (selectedReceipt) {
                          handleDelete(selectedReceipt);
                        }
                      }}
                      disabled={deleteId === selectedReceipt.id}
                    >
                      {deleteId === selectedReceipt.id ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <>
                          <MaterialIcons name="delete" size={20} color="#ef4444" />
                          <Text style={styles.imageModalDeleteText}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  receiptCardWrapper: {
    width: CARD_SIZE,
    marginBottom: CARD_MARGIN,
  },
  receiptCard: {
    width: '100%',
  },
  receiptCardDark: {
    // No special styling needed
  },
  receiptImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  receiptImageContainerDark: {
    backgroundColor: '#374151',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  receiptOverlay: {
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
  receiptOverlayVisible: {
    opacity: 1,
  },
  receiptOverlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  receiptActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptActionButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  receiptDeleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  receiptNotes: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 2,
  },
  receiptNotesDark: {
    color: '#9BA1A6',
  },
  receiptDate: {
    fontSize: 12,
    color: '#666',
  },
  receiptDateDark: {
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
  },
  imageModalDateDark: {
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
});

