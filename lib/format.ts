export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function getYearFromDateString(dateString: string): number {
  const parts = dateString.split('-');
  return parseInt(parts[0], 10);
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    advertising: 'Advertising',
    meals_entertainment: 'Meals & Entertainment',
    insurance: 'Business Insurance',
    business_taxes: 'Business Taxes',
    licenses_memberships: 'Licenses, memberships, & Annual Dues',
    office_expenses: 'Office Expenses',
    office_supplies: 'Office Supplies',
    professional_fees: 'Professional Fees',
    management_admin_fees: 'Management & Admin Fees',
    rent: 'Rent (other than Home Office)',
    repairs_maintenance: 'Repairs and Maintenance',
    salaries_wages: 'Salaries & Wages',
    property_tax: 'Property Tax',
    travel_expenses: 'Travel Expenses',
    utilities: 'Utilities (other than for home office)',
    fuel_costs: 'Fuel (excluding motor vehicles)',
    delivery_freight: 'Delivery & Freight',
    motor_vehicle_expenses: 'Vehicle Expenses',
    home_office_expenses: 'Home Office Expenses',
    commissions_agent_fees: 'Commissions & Agent Fees',
    training: 'Training and Convention',
  };
  
  if (labels[category]) {
    return labels[category];
  }
  
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

