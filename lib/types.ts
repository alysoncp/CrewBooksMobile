// Types and constants from shared schema
// This file contains the types and constants needed for the mobile app

// Self-Employment Expense Categories (from shared schema)
export const SELF_EMPLOYMENT_EXPENSE_CATEGORIES = [
  'advertising',
  'business_taxes',
  'commissions_agent_fees',
  'delivery_freight',
  'fuel_non_vehicle',
  'insurance',
  'licenses_memberships',
  'management_admin_fees',
  'meals_entertainment',
  'office_supplies',
  'professional_fees',
  'repairs_maintenance',
  'salaries_wages',
  'training',
  'travel_expenses',
] as const;

// Home Office / Living Expense Categories
export const HOME_OFFICE_LIVING_CATEGORIES = [
  'rent',
  'utilities',
  'internet',
  'phone',
  'heat',
  'electricity',
  'insurance_home',
  'maintenance_home',
  'mortgage_interest',
  'property_taxes',
] as const;

// Vehicle Expense Categories
export const VEHICLE_CATEGORIES = [
  'fuel_costs',
  'electric_vehicle_charging',
  'vehicle_insurance',
  'parking_tolls',
  'lease_payment',
  'vehicle_repairs',
] as const;

// Tax-deductible Personal Expense Categories
export const TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES = [
  'child_care_expenses',
  'medical_expenses',
  'charitable_donations',
  'moving_expenses',
  'student_loan_interest',
  'disability_supports',
  'investment_counsel_fees',
  'tuition',
] as const;

// Non-deductible Personal Expense Categories
export const NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES = [
  'personal_phone',
  'grocery',
  'entertainment',
  'dining_out',
  'clothing',
  'transportation',
  'insurance_personal',
  'health_fitness',
  'gifts',
  'household_supplies',
] as const;

// All Personal Expense Categories (combined)
export const PERSONAL_EXPENSE_CATEGORIES = [
  ...TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES,
  ...NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES,
] as const;

// Income Types
export const INCOME_TYPES = [
  'union_production',
  'non_union_production',
  'royalty_residual',
  'cash',
] as const;

// Expense Types
export const EXPENSE_TYPES = {
  HOME_OFFICE_LIVING: 'home_office_living',
  VEHICLE: 'vehicle',
  SELF_EMPLOYMENT: 'self_employment',
  PERSONAL: 'personal',
  MIXED: 'mixed',
} as const;

// Tax Filing Status
export const TAX_FILING_STATUS = {
  PERSONAL_ONLY: 'personal_only',
  PERSONAL_AND_CORPORATE: 'personal_and_corporate',
} as const;

// User Types
export const USER_TYPES = {
  PERFORMER: 'performer',
  CREW: 'crew',
  BOTH: 'both',
} as const;

// Unions
export const UNIONS = {
  ACTRA: { id: 'actra', name: 'ACTRA', levels: ['apprentice', 'full', 'background'] },
  UBCP: { id: 'ubcp', name: 'UBCP', levels: ['apprentice', 'full', 'background'] },
  IATSE: { id: 'iatse', name: 'IATSE', levels: ['permittee', 'full'] },
} as const;

// Pricing Tiers
export const PRICING_TIERS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 0,
    description: 'Best for occasional or part time unincorporated performers',
  },
  personal: {
    id: 'personal',
    name: 'Personal',
    price: 9.99,
    description: 'Best for full union members who work regularly but have not yet incorporated',
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    price: 19.99,
    description: 'Best for incorporated businesses',
  },
} as const;

// Type aliases
export type SelfEmploymentExpenseCategory = typeof SELF_EMPLOYMENT_EXPENSE_CATEGORIES[number];
export type HomeOfficeLivingCategory = typeof HOME_OFFICE_LIVING_CATEGORIES[number];
export type VehicleCategory = typeof VEHICLE_CATEGORIES[number];
export type TaxDeductiblePersonalExpenseCategory = typeof TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES[number];
export type NonDeductiblePersonalExpenseCategory = typeof NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES[number];
export type PersonalExpenseCategory = typeof PERSONAL_EXPENSE_CATEGORIES[number];
export type IncomeType = typeof INCOME_TYPES[number];
export type ExpenseType = typeof EXPENSE_TYPES[keyof typeof EXPENSE_TYPES];

// Union Affiliation
export interface UnionAffiliation {
  unionId: string;
  level: string;
}

// Base types (matching shared schema structure)
export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  hasGstNumber?: boolean;
  gstNumber?: string;
  homeOfficePercentage?: number | string;
  enabledExpenseCategories?: string[];
  enabledPersonalExpenseCategories?: string[];
  enabledGeneralExpenseCategories?: string[];
  mileageLoggingStyle?: 'trip_distance' | 'odometer';
  subscriptionTier?: string;
  taxFilingStatus?: string;
  userType?: string;
  unionAffiliations?: UnionAffiliation[];
  hasAgent?: boolean;
  agentName?: string;
  agentCommission?: string;
  hasRegularEmployment?: boolean;
  hasHomeOffice?: boolean;
  [key: string]: any;
}

export interface Income {
  id: string;
  amount: number | string;
  date: string;
  incomeType: string;
  productionName?: string;
  accountingOffice?: string;
  gstHstCollected?: number | string;
  dues?: number | string;
  retirement?: number | string;
  labour?: number | string;
  buyout?: number | string;
  pension?: number | string;
  insurance?: number | string;
  [key: string]: any;
}

export interface Expense {
  id: string;
  amount: number | string;
  baseCost?: number | string;
  gstAmount?: number | string;
  pstAmount?: number | string;
  date: string;
  title?: string;
  category: string;
  subcategory?: string;
  vehicleId?: string;
  vendor?: string;
  description?: string;
  isTaxDeductible?: boolean;
  expenseType?: string;
  businessUsePercentage?: number | string;
  [key: string]: any;
}

export interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  isPrimary?: boolean;
  usedExclusivelyForBusiness?: boolean;
  claimsCca?: boolean;
  ccaClass?: string;
  currentMileage?: number | string;
  totalAnnualMileage?: number | string;
  purchasedThisYear?: boolean;
  purchasePrice?: number | string;
  licensePlate?: string;
  initialOdometerPhotoUrl?: string;
  startOfYearOdometerPhotoUrl?: string;
  endOfYearOdometerPhotoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface VehicleMileageLog {
  id: string;
  vehicleId: string;
  date: string;
  odometerReading: number | string;
  description?: string;
  isBusinessUse?: boolean;
  createdAt?: string;
  updatedAt?: string;
  distance?: number; // Calculated field, not from DB
  [key: string]: any;
}

export interface Receipt {
  id: string;
  filename: string;
  url: string;
  uploadedAt: string;
  expenseId?: string;
  ocrStatus?: string;
  expenseData?: any;
  [key: string]: any;
}

