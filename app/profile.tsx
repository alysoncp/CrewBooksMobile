import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiGet, apiRequest } from '@/lib/api';
import { PRICING_TIERS, TAX_FILING_STATUS, UNIONS, USER_TYPES, type UnionAffiliation, type User } from '@/lib/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfilePage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [taxFilingStatus, setTaxFilingStatus] = useState<typeof TAX_FILING_STATUS[keyof typeof TAX_FILING_STATUS]>(TAX_FILING_STATUS.PERSONAL_ONLY);
  const [userType, setUserType] = useState<string | null>(null);
  const [unionAffiliations, setUnionAffiliations] = useState<UnionAffiliation[]>([]);
  const [hasAgent, setHasAgent] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentCommission, setAgentCommission] = useState('');
  const [hasGstNumber, setHasGstNumber] = useState(false);
  const [gstNumber, setGstNumber] = useState('');

  // Modal states
  const [showUnionLevelPicker, setShowUnionLevelPicker] = useState<string | null>(null);
  const [selectedUnionForLevel, setSelectedUnionForLevel] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const userData = await apiGet<User>('/api/user/profile');
      setUser(userData);
      
      // Populate form
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
      setEmail(userData.email || '');
      setTaxFilingStatus((userData.taxFilingStatus as any) || TAX_FILING_STATUS.PERSONAL_ONLY);
      setUserType((userData.userType as any) || null);
      setUnionAffiliations((userData.unionAffiliations as UnionAffiliation[]) || []);
      setHasAgent(userData.hasAgent || false);
      setAgentName(userData.agentName || '');
      setAgentCommission(userData.agentCommission || '');
      setHasGstNumber(userData.hasGstNumber || false);
      setGstNumber(userData.gstNumber || '');
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await apiRequest('PATCH', '/api/user/profile', {
        firstName,
        lastName,
        email,
        taxFilingStatus,
        userType,
        unionAffiliations,
        hasAgent,
        agentName,
        agentCommission,
        hasGstNumber,
        gstNumber,
        province: 'BC', // Hardcoded to British Columbia
      });
      Alert.alert('Success', 'Profile updated successfully');
      fetchProfile(); // Refresh data
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUnion = (unionId: string, checked: boolean) => {
    if (checked) {
      const defaultLevel = UNIONS[unionId.toUpperCase() as keyof typeof UNIONS]?.levels[0] || '';
      setUnionAffiliations([...unionAffiliations, { unionId, level: defaultLevel }]);
    } else {
      setUnionAffiliations(unionAffiliations.filter((u) => u.unionId !== unionId));
    }
  };

  const updateUnionLevel = (unionId: string, level: string) => {
    setUnionAffiliations(
      unionAffiliations.map((u) => (u.unionId === unionId ? { ...u, level } : u))
    );
    setShowUnionLevelPicker(null);
    setSelectedUnionForLevel(null);
  };

  const getUnionAffiliation = (unionId: string) => {
    return unionAffiliations.find((u) => u.unionId === unionId);
  };

  const isPerformer = userType === USER_TYPES.PERFORMER || userType === USER_TYPES.BOTH;
  const isCrew = userType === USER_TYPES.CREW || userType === USER_TYPES.BOTH;

  const currentTier = user?.subscriptionTier || 'basic';
  const tierInfo = PRICING_TIERS[currentTier as keyof typeof PRICING_TIERS] || PRICING_TIERS.basic;
  const isBasicTier = currentTier === 'basic';
  const isPersonalTier = currentTier === 'personal';
  const isCorporateTier = currentTier === 'corporate';

  if (isLoading) {
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
            <Text style={[styles.title, isDark && styles.titleDark]}>Profile</Text>
            <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
              Manage your account and industry settings
            </Text>
          </View>
        </View>
      </View>

      {/* Subscription Tier Card */}
      <View style={[styles.tierCard, isDark && styles.tierCardDark]}>
        <View style={styles.tierCardContent}>
          <View style={styles.tierCardLeft}>
            <View style={[styles.tierIcon, isDark && styles.tierIconDark]}>
              {isCorporateTier ? (
                <MaterialIcons name="business" size={24} color="#0a7ea4" />
              ) : isPersonalTier ? (
                <MaterialIcons name="person" size={24} color="#0a7ea4" />
              ) : (
                <MaterialIcons name="stars" size={24} color="#0a7ea4" />
              )}
            </View>
            <View style={styles.tierInfo}>
              <View style={styles.tierNameRow}>
                <Text style={[styles.tierName, isDark && styles.tierNameDark]}>
                  {tierInfo.name} Plan
                </Text>
                {isCorporateTier && (
                  <View style={[styles.badge, isDark && styles.badgeDark]}>
                    <MaterialIcons name="workspace-premium" size={14} color="#0a7ea4" />
                    <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>Premium</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tierPrice, isDark && styles.tierPriceDark]}>
                {tierInfo.price === 0 ? 'Free forever' : `$${tierInfo.price}/month`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.manageButton, isDark && styles.manageButtonDark]}
            onPress={() => {
              // TODO: Navigate to pricing page
              Alert.alert('Pricing', 'Pricing page coming soon');
            }}
          >
            <Text style={styles.manageButtonText}>Manage</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#0a7ea4" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Personal Information */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="person" size={24} color="#0a7ea4" />
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
              Personal Information
            </Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              Your basic account details
            </Text>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.labelDark]}>First Name</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder="First name"
            placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.labelDark]}>Last Name</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder="Last name"
            placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.labelDark]}>Email</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder="your@email.com"
            placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Industry Role */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="work" size={24} color="#0a7ea4" />
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Industry Role</Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              Tell us about your role in the film and television industry
            </Text>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.labelDark]}>What type of work do you do?</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[
                styles.radioOption,
                userType === USER_TYPES.PERFORMER && styles.radioOptionSelected,
                isDark && styles.radioOptionDark,
                userType === USER_TYPES.PERFORMER && isDark && styles.radioOptionSelectedDark,
              ]}
              onPress={() => setUserType(USER_TYPES.PERFORMER)}
            >
              <View style={styles.radioOptionContent}>
                <MaterialIcons name="videocam" size={20} color={isDark ? '#ECEDEE' : '#11181C'} />
                <View style={styles.radioOptionText}>
                  <Text style={[styles.radioOptionTitle, isDark && styles.radioOptionTitleDark]}>
                    Performer
                  </Text>
                  <Text style={[styles.radioOptionSubtitle, isDark && styles.radioOptionSubtitleDark]}>
                    Actor, background, stunt, etc.
                  </Text>
                </View>
              </View>
              {userType === USER_TYPES.PERFORMER && (
                <MaterialIcons name="radio-button-checked" size={24} color="#0a7ea4" />
              )}
              {userType !== USER_TYPES.PERFORMER && (
                <MaterialIcons
                  name="radio-button-unchecked"
                  size={24}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radioOption,
                userType === USER_TYPES.CREW && styles.radioOptionSelected,
                isDark && styles.radioOptionDark,
                userType === USER_TYPES.CREW && isDark && styles.radioOptionSelectedDark,
              ]}
              onPress={() => setUserType(USER_TYPES.CREW)}
            >
              <View style={styles.radioOptionContent}>
                <MaterialIcons name="group" size={20} color={isDark ? '#ECEDEE' : '#11181C'} />
                <View style={styles.radioOptionText}>
                  <Text style={[styles.radioOptionTitle, isDark && styles.radioOptionTitleDark]}>
                    Crew
                  </Text>
                  <Text style={[styles.radioOptionSubtitle, isDark && styles.radioOptionSubtitleDark]}>
                    Camera, grips, electric, etc.
                  </Text>
                </View>
              </View>
              {userType === USER_TYPES.CREW && (
                <MaterialIcons name="radio-button-checked" size={24} color="#0a7ea4" />
              )}
              {userType !== USER_TYPES.CREW && (
                <MaterialIcons
                  name="radio-button-unchecked"
                  size={24}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radioOption,
                userType === USER_TYPES.BOTH && styles.radioOptionSelected,
                isDark && styles.radioOptionDark,
                userType === USER_TYPES.BOTH && isDark && styles.radioOptionSelectedDark,
              ]}
              onPress={() => setUserType(USER_TYPES.BOTH)}
            >
              <View style={styles.radioOptionContent}>
                <MaterialIcons name="videocam" size={20} color={isDark ? '#ECEDEE' : '#11181C'} />
                <MaterialIcons name="group" size={20} color={isDark ? '#ECEDEE' : '#11181C'} />
                <View style={styles.radioOptionText}>
                  <Text style={[styles.radioOptionTitle, isDark && styles.radioOptionTitleDark]}>
                    Both
                  </Text>
                  <Text style={[styles.radioOptionSubtitle, isDark && styles.radioOptionSubtitleDark]}>
                    I do both performer and crew work
                  </Text>
                </View>
              </View>
              {userType === USER_TYPES.BOTH && (
                <MaterialIcons name="radio-button-checked" size={24} color="#0a7ea4" />
              )}
              {userType !== USER_TYPES.BOTH && (
                <MaterialIcons
                  name="radio-button-unchecked"
                  size={24}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {userType && (
          <>
            <View style={styles.separator} />

            {/* Union Affiliations */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Union Affiliations</Text>
              <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                Select your union memberships and status
              </Text>

              {isPerformer && (
                <>
                  <View style={[styles.unionCard, isDark && styles.unionCardDark]}>
                    <View style={styles.unionCardHeader}>
                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => toggleUnion('actra', !getUnionAffiliation('actra'))}
                      >
                        <MaterialIcons
                          name={getUnionAffiliation('actra') ? 'check-box' : 'check-box-outline-blank'}
                          size={24}
                          color={
                            getUnionAffiliation('actra')
                              ? isDark
                                ? '#ECEDEE'
                                : '#11181C'
                              : isDark
                                ? '#9BA1A6'
                                : '#d1d5db'
                          }
                        />
                        <Text style={[styles.unionName, isDark && styles.unionNameDark]}>ACTRA</Text>
                      </TouchableOpacity>
                    </View>
                    {getUnionAffiliation('actra') && (
                      <TouchableOpacity
                        style={[styles.select, isDark && styles.selectDark]}
                        onPress={() => {
                          setSelectedUnionForLevel('actra');
                          setShowUnionLevelPicker('actra');
                        }}
                      >
                        <Text style={[styles.selectText, isDark && styles.selectTextDark]}>
                          {getUnionAffiliation('actra')?.level
                            ? getUnionAffiliation('actra')!.level.charAt(0).toUpperCase() +
                              getUnionAffiliation('actra')!.level.slice(1)
                            : 'Select status'}
                        </Text>
                        <MaterialIcons
                          name="arrow-drop-down"
                          size={20}
                          color={isDark ? '#9BA1A6' : '#666'}
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={[styles.unionCard, isDark && styles.unionCardDark]}>
                    <View style={styles.unionCardHeader}>
                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => toggleUnion('ubcp', !getUnionAffiliation('ubcp'))}
                      >
                        <MaterialIcons
                          name={getUnionAffiliation('ubcp') ? 'check-box' : 'check-box-outline-blank'}
                          size={24}
                          color={
                            getUnionAffiliation('ubcp')
                              ? isDark
                                ? '#ECEDEE'
                                : '#11181C'
                              : isDark
                                ? '#9BA1A6'
                                : '#d1d5db'
                          }
                        />
                        <Text style={[styles.unionName, isDark && styles.unionNameDark]}>UBCP</Text>
                      </TouchableOpacity>
                    </View>
                    {getUnionAffiliation('ubcp') && (
                      <TouchableOpacity
                        style={[styles.select, isDark && styles.selectDark]}
                        onPress={() => {
                          setSelectedUnionForLevel('ubcp');
                          setShowUnionLevelPicker('ubcp');
                        }}
                      >
                        <Text style={[styles.selectText, isDark && styles.selectTextDark]}>
                          {getUnionAffiliation('ubcp')?.level
                            ? getUnionAffiliation('ubcp')!.level.charAt(0).toUpperCase() +
                              getUnionAffiliation('ubcp')!.level.slice(1)
                            : 'Select status'}
                        </Text>
                        <MaterialIcons
                          name="arrow-drop-down"
                          size={20}
                          color={isDark ? '#9BA1A6' : '#666'}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {isCrew && (
                <View style={[styles.unionCard, isDark && styles.unionCardDark]}>
                  <View style={styles.unionCardHeader}>
                    <TouchableOpacity
                      style={styles.checkboxContainer}
                      onPress={() => toggleUnion('iatse', !getUnionAffiliation('iatse'))}
                    >
                      <MaterialIcons
                        name={getUnionAffiliation('iatse') ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={
                          getUnionAffiliation('iatse')
                            ? isDark
                              ? '#ECEDEE'
                              : '#11181C'
                            : isDark
                              ? '#9BA1A6'
                              : '#d1d5db'
                        }
                      />
                      <Text style={[styles.unionName, isDark && styles.unionNameDark]}>IATSE</Text>
                    </TouchableOpacity>
                  </View>
                  {getUnionAffiliation('iatse') && (
                    <TouchableOpacity
                      style={[styles.select, isDark && styles.selectDark]}
                      onPress={() => {
                        setSelectedUnionForLevel('iatse');
                        setShowUnionLevelPicker('iatse');
                      }}
                    >
                      <Text style={[styles.selectText, isDark && styles.selectTextDark]}>
                        {getUnionAffiliation('iatse')?.level
                          ? getUnionAffiliation('iatse')!.level.charAt(0).toUpperCase() +
                            getUnionAffiliation('iatse')!.level.slice(1)
                          : 'Select status'}
                      </Text>
                      <MaterialIcons
                        name="arrow-drop-down"
                        size={20}
                        color={isDark ? '#9BA1A6' : '#666'}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Agent/Manager Info (for Performers) */}
            {isPerformer && (
              <>
                <View style={styles.separator} />
                <View style={styles.switchRow}>
                  <View style={styles.switchRowLeft}>
                    <Text style={[styles.switchLabel, isDark && styles.switchLabelDark]}>
                      Representation
                    </Text>
                    <Text style={[styles.switchHelper, isDark && styles.switchHelperDark]}>
                      Do you have an agent or manager?
                    </Text>
                  </View>
                  <Switch
                    value={hasAgent}
                    onValueChange={setHasAgent}
                    trackColor={{ false: isDark ? '#374151' : '#d1d5db', true: '#0a7ea4' }}
                    thumbColor="#fff"
                  />
                </View>

                {hasAgent && (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={[styles.label, isDark && styles.labelDark]}>
                        Agent/Manager Name
                      </Text>
                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder="Agent or agency name"
                        placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                        value={agentName}
                        onChangeText={setAgentName}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.label, isDark && styles.labelDark]}>
                        Commission Rate (%)
                      </Text>
                      <View style={[styles.percentageInput, isDark && styles.percentageInputDark]}>
                        <TextInput
                          style={[styles.inputInPercentage, isDark && styles.inputInPercentageDark]}
                          placeholder="10"
                          placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
                          value={agentCommission}
                          onChangeText={setAgentCommission}
                          keyboardType="decimal-pad"
                        />
                        <Text style={[styles.percentageSymbol, isDark && styles.percentageSymbolDark]}>
                          %
                        </Text>
                      </View>
                      <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
                        Typically 10-15%
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </>
        )}
      </View>

      {/* Business & Tax Information */}
      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="business" size={24} color="#0a7ea4" />
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>
              Business & Tax Information
            </Text>
            <Text style={[styles.cardDescription, isDark && styles.cardDescriptionDark]}>
              Your tax filing status and business registration
            </Text>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, isDark && styles.labelDark]}>Tax Filing Status</Text>
          <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
            Select how you file your taxes. This affects which features are available.
          </Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[
                styles.radioOption,
                taxFilingStatus === TAX_FILING_STATUS.PERSONAL_ONLY && styles.radioOptionSelected,
                isDark && styles.radioOptionDark,
                taxFilingStatus === TAX_FILING_STATUS.PERSONAL_ONLY &&
                  isDark &&
                  styles.radioOptionSelectedDark,
              ]}
              onPress={() => setTaxFilingStatus(TAX_FILING_STATUS.PERSONAL_ONLY)}
            >
              <View style={styles.radioOptionContent}>
                <View style={styles.radioOptionText}>
                  <Text style={[styles.radioOptionTitle, isDark && styles.radioOptionTitleDark]}>
                    Personal Taxes Only
                  </Text>
                  <Text style={[styles.radioOptionSubtitle, isDark && styles.radioOptionSubtitleDark]}>
                    I file as a sole proprietor or employee
                  </Text>
                </View>
              </View>
              {taxFilingStatus === TAX_FILING_STATUS.PERSONAL_ONLY && (
                <MaterialIcons name="radio-button-checked" size={24} color="#0a7ea4" />
              )}
              {taxFilingStatus !== TAX_FILING_STATUS.PERSONAL_ONLY && (
                <MaterialIcons
                  name="radio-button-unchecked"
                  size={24}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.radioOption,
                taxFilingStatus === TAX_FILING_STATUS.PERSONAL_AND_CORPORATE &&
                  styles.radioOptionSelected,
                isDark && styles.radioOptionDark,
                taxFilingStatus === TAX_FILING_STATUS.PERSONAL_AND_CORPORATE &&
                  isDark &&
                  styles.radioOptionSelectedDark,
              ]}
              onPress={() => setTaxFilingStatus(TAX_FILING_STATUS.PERSONAL_AND_CORPORATE)}
            >
              <View style={styles.radioOptionContent}>
                <View style={styles.radioOptionText}>
                  <View style={styles.radioOptionTitleRow}>
                    <Text style={[styles.radioOptionTitle, isDark && styles.radioOptionTitleDark]}>
                      Personal + Corporate
                    </Text>
                    <View style={[styles.badgeSmall, isDark && styles.badgeSmallDark]}>
                      <Text style={[styles.badgeSmallText, isDark && styles.badgeSmallTextDark]}>
                        Inc.
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.radioOptionSubtitle, isDark && styles.radioOptionSubtitleDark]}>
                    I have an incorporated business
                  </Text>
                </View>
              </View>
              {taxFilingStatus === TAX_FILING_STATUS.PERSONAL_AND_CORPORATE && (
                <MaterialIcons name="radio-button-checked" size={24} color="#0a7ea4" />
              )}
              {taxFilingStatus !== TAX_FILING_STATUS.PERSONAL_AND_CORPORATE && (
                <MaterialIcons
                  name="radio-button-unchecked"
                  size={24}
                  color={isDark ? '#9BA1A6' : '#666'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchRowLeft}>
            <Text style={[styles.switchLabel, isDark && styles.switchLabelDark]}>
              GST/HST Registration
            </Text>
            <Text style={[styles.switchHelper, isDark && styles.switchHelperDark]}>
              Are you registered to collect GST?
            </Text>
          </View>
          <Switch
            value={hasGstNumber}
            onValueChange={setHasGstNumber}
            trackColor={{ false: isDark ? '#374151' : '#d1d5db', true: '#0a7ea4' }}
            thumbColor="#fff"
          />
        </View>

        {hasGstNumber && (
          <View style={styles.formGroup}>
            <Text style={[styles.label, isDark && styles.labelDark]}>GST/HST Number</Text>
            <TextInput
              style={[styles.input, isDark && styles.inputDark]}
              placeholder="123456789RT0001"
              placeholderTextColor={isDark ? '#9BA1A6' : '#666'}
              value={gstNumber}
              onChangeText={setGstNumber}
            />
            <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
              Your GST/HST registration number (enables GST/HST tracking)
            </Text>
          </View>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled, isDark && styles.saveButtonDark]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>

      {/* Union Level Picker Modal */}
      <Modal
        visible={showUnionLevelPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowUnionLevelPicker(null);
          setSelectedUnionForLevel(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowUnionLevelPicker(null);
            setSelectedUnionForLevel(null);
          }}
        >
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
              <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
                Select Union Status
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowUnionLevelPicker(null);
                  setSelectedUnionForLevel(null);
                }}
              >
                <MaterialIcons name="close" size={24} color={isDark ? '#ECEDEE' : '#11181C'} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {selectedUnionForLevel &&
                UNIONS[selectedUnionForLevel.toUpperCase() as keyof typeof UNIONS]?.levels.map(
                  (level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.modalOption,
                        getUnionAffiliation(selectedUnionForLevel)?.level === level &&
                          styles.modalOptionSelected,
                        isDark && styles.modalOptionDark,
                      ]}
                      onPress={() => updateUnionLevel(selectedUnionForLevel, level)}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          isDark && styles.modalOptionTextDark,
                          getUnionAffiliation(selectedUnionForLevel)?.level === level &&
                            styles.modalOptionTextSelected,
                        ]}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                      {getUnionAffiliation(selectedUnionForLevel)?.level === level && (
                        <MaterialIcons name="check" size={24} color="#0a7ea4" />
                      )}
                    </TouchableOpacity>
                  )
                )}
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
    flexShrink: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  titleDark: {
    color: '#ECEDEE',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  subtitleDark: {
    color: '#9BA1A6',
  },
  loader: {
    marginVertical: 32,
    alignItems: 'center',
  },
  tierCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 16,
  },
  tierCardDark: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  tierCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tierIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierIconDark: {
    backgroundColor: '#1e40af',
  },
  tierInfo: {
    flex: 1,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  tierNameDark: {
    color: '#ECEDEE',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeDark: {
    backgroundColor: '#374151',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  badgeTextDark: {
    color: '#60a5fa',
  },
  tierPrice: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  tierPriceDark: {
    color: '#9BA1A6',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  manageButtonDark: {
    borderColor: '#3b82f6',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a7ea4',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  cardTitleDark: {
    color: '#ECEDEE',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  cardDescriptionDark: {
    color: '#9BA1A6',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#11181C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
    flexWrap: 'wrap',
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
    marginTop: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 16,
  },
  helperTextDark: {
    color: '#9BA1A6',
  },
  radioGroup: {
    gap: 12,
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  radioOptionDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  radioOptionSelected: {
    borderColor: '#0a7ea4',
    backgroundColor: '#f0f9ff',
  },
  radioOptionSelectedDark: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a8a',
  },
  radioOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioOptionText: {
    flex: 1,
  },
  radioOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  radioOptionTitleDark: {
    color: '#ECEDEE',
  },
  radioOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  radioOptionSubtitle: {
    fontSize: 12,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 16,
  },
  radioOptionSubtitleDark: {
    color: '#9BA1A6',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  unionCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  unionCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  unionCardHeader: {
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  unionNameDark: {
    color: '#ECEDEE',
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  selectDark: {
    backgroundColor: '#4b5563',
    borderColor: '#6b7280',
  },
  selectText: {
    fontSize: 16,
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  selectTextDark: {
    color: '#ECEDEE',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  switchRowLeft: {
    flex: 1,
    marginRight: 16,
    flexShrink: 1,
    minWidth: 200,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  switchLabelDark: {
    color: '#ECEDEE',
  },
  switchHelper: {
    fontSize: 12,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 16,
  },
  switchHelperDark: {
    color: '#9BA1A6',
  },
  percentageInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  percentageInputDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  inputInPercentage: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    paddingLeft: 16,
    color: '#11181C',
    backgroundColor: 'transparent',
  },
  inputInPercentageDark: {
    color: '#ECEDEE',
  },
  percentageSymbol: {
    fontSize: 16,
    fontWeight: '600',
    paddingRight: 16,
    color: '#11181C',
  },
  percentageSymbolDark: {
    color: '#ECEDEE',
  },
  badgeSmall: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSmallDark: {
    backgroundColor: '#374151',
  },
  badgeSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#11181C',
  },
  badgeSmallTextDark: {
    color: '#ECEDEE',
  },
  saveButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDark: {
    backgroundColor: '#0a7ea4',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    width: '80%',
    maxHeight: '60%',
  },
  modalContentDark: {
    backgroundColor: '#1f2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalHeaderDark: {
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  modalTitleDark: {
    color: '#ECEDEE',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalOptionDark: {
    borderBottomColor: '#374151',
  },
  modalOptionSelected: {
    backgroundColor: '#f0f9ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#11181C',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  modalOptionTextDark: {
    color: '#ECEDEE',
  },
  modalOptionTextSelected: {
    fontWeight: '600',
    color: '#0a7ea4',
  },
});

