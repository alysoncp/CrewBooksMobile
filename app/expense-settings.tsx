import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiGet, apiRequest } from '@/lib/api';
import { getCategoryLabel, getPersonalExpenseCategoryLabel } from '@/lib/format';
import {
  NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES,
  PERSONAL_EXPENSE_CATEGORIES,
  SELF_EMPLOYMENT_EXPENSE_CATEGORIES,
  TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES,
  type Expense,
  type User,
} from '@/lib/types';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ExpenseSettingsPage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<User | null>(null);
  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [homeOfficePercentage, setHomeOfficePercentage] = useState<string>('');
  const [isSavingPercentage, setIsSavingPercentage] = useState(false);
  const [customCategories, setCustomCategories] = useState<Set<string>>(new Set());
  const [customPersonalCategories, setCustomPersonalCategories] = useState<Set<string>>(new Set());
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [newCustomPersonalCategory, setNewCustomPersonalCategory] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedPersonalCategories, setSelectedPersonalCategories] = useState<Set<string>>(new Set());
  const [isSavingCategories, setIsSavingCategories] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userData, expenses] = await Promise.all([
        apiGet<User>('/api/user/profile'),
        apiGet<Expense[]>('/api/expenses'),
      ]);
      setUser(userData);
      setExpenseList(expenses);

      // Initialize home office percentage
      if (userData?.homeOfficePercentage !== null && userData?.homeOfficePercentage !== undefined) {
        const percentageValue = parseFloat(userData.homeOfficePercentage.toString());
        setHomeOfficePercentage(percentageValue.toString());
      } else {
        setHomeOfficePercentage('');
      }

      // Initialize categories
      if (userData?.enabledExpenseCategories) {
        const allCategories = userData.enabledExpenseCategories as string[];
        const predefined = new Set(SELF_EMPLOYMENT_EXPENSE_CATEGORIES);
        const enabledPredefined = allCategories.filter((cat) => predefined.has(cat as any));
        const custom = allCategories.filter((cat) => !predefined.has(cat as any));
        setCustomCategories(new Set(custom));
        setSelectedCategories(new Set(enabledPredefined));
      } else {
        setSelectedCategories(new Set(SELF_EMPLOYMENT_EXPENSE_CATEGORIES));
      }

      if (userData?.enabledPersonalExpenseCategories) {
        const allCategories = userData.enabledPersonalExpenseCategories as string[];
        const predefined = new Set(PERSONAL_EXPENSE_CATEGORIES);
        const enabledPredefined = allCategories.filter((cat) => predefined.has(cat as any));
        const custom = allCategories.filter((cat) => !predefined.has(cat as any));
        setCustomPersonalCategories(new Set(custom));
        setSelectedPersonalCategories(new Set(enabledPredefined));
      } else {
        setSelectedPersonalCategories(new Set(PERSONAL_EXPENSE_CATEGORIES));
      }

      // Merge general categories into personal categories
      if (userData?.enabledGeneralExpenseCategories) {
        const generalCategories = userData.enabledGeneralExpenseCategories as string[];
        setCustomPersonalCategories((prev) => {
          const updated = new Set(prev);
          generalCategories.forEach((cat) => {
            if (!PERSONAL_EXPENSE_CATEGORIES.includes(cat as any)) {
              updated.add(cat);
            }
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveHomeOfficePercentage = async () => {
    const percentage = homeOfficePercentage.trim() === '' ? null : parseFloat(homeOfficePercentage);

    if (percentage !== null && (isNaN(percentage) || percentage < 0 || percentage > 100)) {
      Alert.alert('Error', 'Please enter a value between 0 and 100');
      return;
    }

    try {
      setIsSavingPercentage(true);
      await apiRequest('PATCH', '/api/user/profile', {
        homeOfficePercentage: percentage,
      });
      // Refresh user data to get updated value
      const userData = await apiGet<User>('/api/user/profile');
      setUser(userData);
      // Update the displayed value
      if (userData?.homeOfficePercentage) {
        setHomeOfficePercentage(parseFloat(userData.homeOfficePercentage.toString()).toString());
      } else {
        setHomeOfficePercentage('');
      }
      Alert.alert('Success', 'Home office percentage updated');
    } catch (error) {
      console.error('Error updating home office percentage:', error);
      Alert.alert('Error', 'Failed to update home office percentage');
    } finally {
      setIsSavingPercentage(false);
    }
  };

  const handleSaveCategories = async () => {
    try {
      setIsSavingCategories(true);
      const allBusinessCategories = Array.from(selectedCategories).concat(Array.from(customCategories));
      const allPersonalCategories = Array.from(selectedPersonalCategories).concat(
        Array.from(customPersonalCategories)
      );

      await apiRequest('PATCH', '/api/user/profile', {
        enabledExpenseCategories: allBusinessCategories,
        enabledPersonalExpenseCategories: allPersonalCategories,
      });
      Alert.alert('Success', 'Categories updated');
    } catch (error) {
      console.error('Error updating categories:', error);
      Alert.alert('Error', 'Failed to update categories');
    } finally {
      setIsSavingCategories(false);
    }
  };

  const handleAddCustomCategory = () => {
    const trimmed = newCustomCategory.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }
    if (customCategories.has(trimmed) || SELF_EMPLOYMENT_EXPENSE_CATEGORIES.includes(trimmed as any)) {
      Alert.alert('Error', 'This category already exists');
      return;
    }
    setCustomCategories((prev) => {
      const updated = new Set(prev);
      updated.add(trimmed);
      return updated;
    });
    setNewCustomCategory('');
  };

  const handleRemoveCustomCategory = (category: string) => {
    setCustomCategories((prev) => {
      const updated = new Set(prev);
      updated.delete(category);
      return updated;
    });
  };

  const handleAddCustomPersonalCategory = () => {
    const trimmed = newCustomPersonalCategory.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }
    if (
      customPersonalCategories.has(trimmed) ||
      PERSONAL_EXPENSE_CATEGORIES.includes(trimmed as any)
    ) {
      Alert.alert('Error', 'This category already exists');
      return;
    }
    setCustomPersonalCategories((prev) => {
      const updated = new Set(prev);
      updated.add(trimmed);
      return updated;
    });
    setNewCustomPersonalCategory('');
  };

  const handleRemoveCustomPersonalCategory = (category: string) => {
    setCustomPersonalCategories((prev) => {
      const updated = new Set(prev);
      updated.delete(category);
      return updated;
    });
  };

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    expenseList.forEach((expense) => {
      if (expense.category) {
        counts.set(expense.category, (counts.get(expense.category) || 0) + 1);
      }
    });
    return counts;
  }, [expenseList]);

  const formatCustomCategoryLabel = (category: string) => {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const sortedSelfEmploymentCategories = useMemo(() => {
    return Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES).sort((a, b) =>
      getCategoryLabel(a).localeCompare(getCategoryLabel(b))
    );
  }, []);

  const sortedTaxDeductiblePersonal = useMemo(() => {
    return Array.from(TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES).sort((a, b) =>
      getPersonalExpenseCategoryLabel(a).localeCompare(getPersonalExpenseCategoryLabel(b))
    );
  }, []);

  const sortedNonDeductiblePersonal = useMemo(() => {
    return Array.from(NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES).sort((a, b) =>
      getPersonalExpenseCategoryLabel(a).localeCompare(getPersonalExpenseCategoryLabel(b))
    );
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={isDark ? '#9BA1A6' : '#666'} style={styles.loader} />
      </View>
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
            <Text style={[styles.title, isDark && styles.titleDark]}>Expense Settings</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Manage your expense settings
            </Text>
          </View>
        </View>
      </View>

      {/* Self-Employment Expense Configuration */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
              Self-Employment Expense Configuration
            </Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              Configure your self-employment expense settings. All expense categories are available
              when creating expenses based on the expense type you select.
            </Text>
          </View>
        </View>

        {/* Home Office Percentage */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Home Office Percentage
          </Text>
          <Text style={[styles.sectionDescription, isDark && styles.sectionDescriptionDark]}>
            Enter the percentage of your home used for business purposes:
          </Text>
          <View style={[styles.percentageContainer, isDark && styles.percentageContainerDark]}>
            <TextInput
              style={[styles.percentageInput, isDark && styles.percentageInputDark]}
              placeholder="0.00"
              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
              value={homeOfficePercentage}
              onChangeText={setHomeOfficePercentage}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.percentageSymbol, isDark && styles.percentageSymbolDark]}>%</Text>
          </View>
          <TouchableOpacity
            style={[styles.saveButton, isSavingPercentage && styles.saveButtonDisabled]}
            onPress={handleSaveHomeOfficePercentage}
            disabled={isSavingPercentage}
          >
            {isSavingPercentage ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
            Home office expenses include: Rent, Utilities, Internet, Heat, Electricity, Home
            Insurance, Home Maintenance, Mortgage Interest, Property Taxes
          </Text>
        </View>

        {/* Self-Employment Expense Categories */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark, { flex: 1, marginRight: 8 }]}>
              Self-Employment Expense Categories
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.buttonSmall, isDark && styles.buttonSmallDark]}
                onPress={() => {
                  setSelectedCategories(new Set(SELF_EMPLOYMENT_EXPENSE_CATEGORIES));
                }}
              >
                <Text style={[styles.buttonSmallText, isDark && styles.buttonSmallTextDark]}>
                  Select All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonSmall, isDark && styles.buttonSmallDark]}
                onPress={() => {
                  setSelectedCategories(new Set());
                }}
              >
                <Text style={[styles.buttonSmallText, isDark && styles.buttonSmallTextDark]}>
                  Deselect All
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.categoryGrid}>
            {sortedSelfEmploymentCategories.map((category) => {
              const count = categoryCounts.get(category) || 0;
              const isSelected = selectedCategories.has(category);
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemSelected,
                    isDark && styles.categoryItemDark,
                    isSelected && isDark && styles.categoryItemSelectedDark,
                  ]}
                  onPress={() => {
                    setSelectedCategories((prev) => {
                      const updated = new Set(prev);
                      if (isSelected) {
                        updated.delete(category);
                      } else {
                        updated.add(category);
                      }
                      return updated;
                    });
                  }}
                >
                  <MaterialIcons
                    name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                    size={20}
                    color={isSelected ? (isDark ? '#ECEDEE' : '#11181C') : (isDark ? '#9BA1A6' : '#d1d5db')}
                  />
                  <Text
                    style={[
                      styles.categoryItemText,
                      isDark && styles.categoryItemTextDark,
                      isSelected && styles.categoryItemTextSelected,
                    ]}
                  >
                    {getCategoryLabel(category)}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.badge, isDark && styles.badgeDark]}>
                      <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Custom Categories */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Custom Categories
          </Text>
          <View style={styles.addCategoryContainer}>
            <TextInput
              style={[styles.addCategoryInput, isDark && styles.addCategoryInputDark]}
              placeholder="Enter custom category name"
              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
              value={newCustomCategory}
              onChangeText={setNewCustomCategory}
            />
            <TouchableOpacity style={styles.addCategoryButton} onPress={handleAddCustomCategory}>
              <MaterialIcons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {customCategories.size > 0 && (
            <View style={styles.customCategoriesList}>
              {Array.from(customCategories).map((category) => (
                <View key={category} style={[styles.categoryBadge, isDark && styles.categoryBadgeDark]}>
                  <Text style={[styles.categoryBadgeText, isDark && styles.categoryBadgeTextDark]}>
                    {formatCustomCategoryLabel(category)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveCustomCategory(category)}
                    style={styles.removeCategoryButton}
                  >
                    <MaterialIcons name="close" size={16} color={isDark ? '#9BA1A6' : '#666'} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveAllButton, isSavingCategories && styles.saveAllButtonDisabled]}
          onPress={handleSaveCategories}
          disabled={isSavingCategories}
        >
          {isSavingCategories ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveAllButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Personal Expense Configuration */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
              Personal Expense Configuration
            </Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              Configure your personal expense settings. All personal expense categories (both
              tax-deductible and non-deductible) are available when creating personal expenses.
            </Text>
          </View>
        </View>

        {/* Tax-Deductible Personal Expense Categories */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark, { flex: 1, marginRight: 8 }]}>
              Tax-Deductible Personal Expenses
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.buttonSmall, isDark && styles.buttonSmallDark]}
                onPress={() => {
                  setSelectedPersonalCategories((prev) => {
                    const updated = new Set(prev);
                    TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES.forEach((cat) => updated.add(cat));
                    return updated;
                  });
                }}
              >
                <Text style={[styles.buttonSmallText, isDark && styles.buttonSmallTextDark]}>
                  Select All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonSmall, isDark && styles.buttonSmallDark]}
                onPress={() => {
                  setSelectedPersonalCategories((prev) => {
                    const updated = new Set(prev);
                    TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES.forEach((cat) => updated.delete(cat));
                    return updated;
                  });
                }}
              >
                <Text style={[styles.buttonSmallText, isDark && styles.buttonSmallTextDark]}>
                  Deselect All
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.categoryGrid}>
            {sortedTaxDeductiblePersonal.map((category) => {
              const count = categoryCounts.get(category) || 0;
              const isSelected = selectedPersonalCategories.has(category);
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemSelected,
                    isDark && styles.categoryItemDark,
                    isSelected && isDark && styles.categoryItemSelectedDark,
                  ]}
                  onPress={() => {
                    setSelectedPersonalCategories((prev) => {
                      const updated = new Set(prev);
                      if (isSelected) {
                        updated.delete(category);
                      } else {
                        updated.add(category);
                      }
                      return updated;
                    });
                  }}
                >
                  <MaterialIcons
                    name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                    size={20}
                    color={isSelected ? (isDark ? '#ECEDEE' : '#11181C') : (isDark ? '#9BA1A6' : '#d1d5db')}
                  />
                  <Text
                    style={[
                      styles.categoryItemText,
                      isDark && styles.categoryItemTextDark,
                      isSelected && styles.categoryItemTextSelected,
                    ]}
                  >
                    {getPersonalExpenseCategoryLabel(category)}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.badge, isDark && styles.badgeDark]}>
                      <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Non-Deductible Personal Expense Categories */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark, { flex: 1, marginRight: 8 }]}>
              Non-Deductible Personal Expenses
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.buttonSmall, isDark && styles.buttonSmallDark]}
                onPress={() => {
                  setSelectedPersonalCategories((prev) => {
                    const updated = new Set(prev);
                    NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES.forEach((cat) => updated.add(cat));
                    return updated;
                  });
                }}
              >
                <Text style={[styles.buttonSmallText, isDark && styles.buttonSmallTextDark]}>
                  Select All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonSmall, isDark && styles.buttonSmallDark]}
                onPress={() => {
                  setSelectedPersonalCategories((prev) => {
                    const updated = new Set(prev);
                    NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES.forEach((cat) => updated.delete(cat));
                    return updated;
                  });
                }}
              >
                <Text style={[styles.buttonSmallText, isDark && styles.buttonSmallTextDark]}>
                  Deselect All
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.categoryGrid}>
            {sortedNonDeductiblePersonal.map((category) => {
              const count = categoryCounts.get(category) || 0;
              const isSelected = selectedPersonalCategories.has(category);
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryItem,
                    isSelected && styles.categoryItemSelected,
                    isDark && styles.categoryItemDark,
                    isSelected && isDark && styles.categoryItemSelectedDark,
                  ]}
                  onPress={() => {
                    setSelectedPersonalCategories((prev) => {
                      const updated = new Set(prev);
                      if (isSelected) {
                        updated.delete(category);
                      } else {
                        updated.add(category);
                      }
                      return updated;
                    });
                  }}
                >
                  <MaterialIcons
                    name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                    size={20}
                    color={isSelected ? (isDark ? '#ECEDEE' : '#11181C') : (isDark ? '#9BA1A6' : '#d1d5db')}
                  />
                  <Text
                    style={[
                      styles.categoryItemText,
                      isDark && styles.categoryItemTextDark,
                      isSelected && styles.categoryItemTextSelected,
                    ]}
                  >
                    {getPersonalExpenseCategoryLabel(category)}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.badge, isDark && styles.badgeDark]}>
                      <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Custom Personal Categories */}
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Custom Personal Categories
          </Text>
          <View style={styles.addCategoryContainer}>
            <TextInput
              style={[styles.addCategoryInput, isDark && styles.addCategoryInputDark]}
              placeholder="Enter custom personal category name"
              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
              value={newCustomPersonalCategory}
              onChangeText={setNewCustomPersonalCategory}
            />
            <TouchableOpacity
              style={styles.addCategoryButton}
              onPress={handleAddCustomPersonalCategory}
            >
              <MaterialIcons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          {customPersonalCategories.size > 0 && (
            <View style={styles.customCategoriesList}>
              {Array.from(customPersonalCategories).map((category) => (
                <View key={category} style={[styles.categoryBadge, isDark && styles.categoryBadgeDark]}>
                  <Text style={[styles.categoryBadgeText, isDark && styles.categoryBadgeTextDark]}>
                    {formatCustomCategoryLabel(category)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveCustomPersonalCategory(category)}
                    style={styles.removeCategoryButton}
                  >
                    <MaterialIcons name="close" size={16} color={isDark ? '#9BA1A6' : '#666'} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveAllButton, isSavingCategories && styles.saveAllButtonDisabled]}
          onPress={handleSaveCategories}
          disabled={isSavingCategories}
        >
          {isSavingCategories ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveAllButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 20,
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
    lineHeight: 20,
  },
  cardDescriptionDark: {
    color: '#9BA1A6',
  },
  section: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 8,
    flexShrink: 1,
  },
  sectionTitleDark: {
    color: '#ECEDEE',
  },
  sectionDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  sectionDescriptionDark: {
    color: '#9BA1A6',
  },
  percentageContainer: {
    flexDirection: 'row',
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
    marginBottom: 12,
  },
  percentageContainerDark: {
    backgroundColor: '#1f2937',
    borderColor: '#4b5563',
  },
  percentageInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  percentageInputDark: {
    color: '#FFFFFF',
  },
  percentageSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    paddingLeft: 8,
  },
  percentageSymbolDark: {
    color: '#ECEDEE',
  },
  saveButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  helperTextDark: {
    color: '#9BA1A6',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  buttonSmallDark: {
    backgroundColor: '#1f2937',
    borderColor: '#4b5563',
  },
  buttonSmallText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#11181C',
  },
  buttonSmallTextDark: {
    color: '#ECEDEE',
  },
  categoryGrid: {
    flexDirection: 'column',
    gap: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '100%',
  },
  categoryItemSelected: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0a7ea4',
  },
  categoryItemDark: {
    backgroundColor: '#1f2937',
    borderColor: '#4b5563',
  },
  categoryItemSelectedDark: {
    backgroundColor: '#1e3a5f',
    borderColor: '#0a7ea4',
  },
  categoryItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#11181C',
    marginLeft: 8,
    flex: 1,
  },
  categoryItemTextDark: {
    color: '#ECEDEE',
  },
  categoryItemTextSelected: {
    color: '#0a7ea4',
  },
  badge: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeDark: {
    backgroundColor: '#4b5563',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  badgeTextDark: {
    color: '#9BA1A6',
  },
  addCategoryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  addCategoryInput: {
    flex: 1,
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
  addCategoryInputDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
    color: '#ECEDEE',
  },
  addCategoryButton: {
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
  customCategoriesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryBadgeDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  categoryBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#11181C',
    marginRight: 8,
  },
  categoryBadgeTextDark: {
    color: '#ECEDEE',
  },
  removeCategoryButton: {
    padding: 2,
  },
  saveAllButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 8,
  },
  saveAllButtonDisabled: {
    opacity: 0.6,
  },
  saveAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
