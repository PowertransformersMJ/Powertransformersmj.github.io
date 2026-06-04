/**
 * crm-architect — Universal CRM type definitions (+ real-estate & dealership packs)
 * Use as the single source of truth for the data model. Adapt field names/enums
 * per client; extend `customFields` for ad-hoc fields. See references/core/data-model.md.
 */

// ---- shared primitives -------------------------------------------------------
export type ISODate = string;            // '2026-06-03T12:00:00Z'
export type Timestamp = number | object; // Firestore Timestamp or epoch ms
export type ID = string;
export type Currency = 'COP' | 'USD' | 'EUR' | string;

export type Role = 'super_admin' | 'admin' | 'manager' | 'agent' | 'bdc' | 'viewer';

export interface SystemFields {
  id: ID;
  orgId: ID;
  createdAt: Timestamp;
  createdBy: ID;
  createdByName?: string;
  updatedAt?: Timestamp;
  updatedBy?: ID;
  _version: number;            // optimistic locking
  customFields?: Record<string, unknown>;
  tags?: string[];
}

export interface Address {
  line?: string; neighborhood?: string; city?: string;
  state?: string; country?: string; postal?: string;
  geo?: { lat: number; lng: number };
}

export interface Consent {
  email?: boolean; sms?: boolean; whatsapp?: boolean; calls?: boolean;
  askedAt?: ISODate; source?: string; ip?: string; policyVersion?: string;
}

// ---- org / user --------------------------------------------------------------
export type Vertical = 'real_estate' | 'automotive' | 'generic' | string;

export interface Org {
  id: ID; name: string; slug?: string; plan?: string;
  vertical: Vertical; locale: string; currency: Currency; timezone: string;
  branding?: { logo?: string; primaryColor?: string };
  features?: string[]; settings?: Record<string, unknown>; createdAt: Timestamp;
}

export interface User extends SystemFields {
  uid: ID; email: string; name: string; role: Role;
  status: 'active' | 'suspended'; photoURL?: string; phone?: string;
  teamId?: ID; managerId?: ID; quota?: number; goals?: Record<string, number>;
  twoFactorEnabled?: boolean; permissions?: string[]; lastLoginAt?: Timestamp;
}

// ---- lead / contact / account ------------------------------------------------
export type LeadSource =
  | 'web_form' | 'portal' | 'ads' | 'referral' | 'walk_in'
  | 'call' | 'whatsapp' | 'import' | 'manual' | string;
export type LeadStatus =
  'new' | 'working' | 'nurturing' | 'qualified' | 'unqualified' | 'converted';
export type Rating = 'hot' | 'warm' | 'cold';

export interface Lead extends SystemFields {
  firstName?: string; lastName: string; fullName?: string;
  company?: string; title?: string;
  email?: string; phone?: string; mobile?: string;
  source: LeadSource; sourceDetail?: string;
  status: LeadStatus; rating?: Rating; score?: number; scoreBreakdown?: ScoreFactor[];
  ownerId: ID; ownerName?: string; assignedAt?: Timestamp;
  campaignId?: ID; address?: Address; notes?: string;
  doNotContact?: boolean; consent?: Consent; lostReason?: string;
  convertedTo?: { contactId?: ID; accountId?: ID; dealId?: ID }; convertedAt?: Timestamp;
  lastActivityAt?: Timestamp; lastContactedAt?: Timestamp;
}

export type ContactType = 'buyer' | 'seller' | 'tenant' | 'landlord' | 'customer' | string;
export type LifecycleStage = 'subscriber' | 'lead' | 'sql' | 'customer' | 'evangelist';

export interface Contact extends SystemFields {
  firstName?: string; lastName: string; fullName?: string;
  email?: string; phone?: string; mobile?: string;
  accountId?: ID; accountName?: string; title?: string; type?: ContactType;
  address?: Address; birthday?: ISODate; lifecycleStage?: LifecycleStage;
  ownerId: ID; ownerName?: string; doNotContact?: boolean; consent?: Consent;
  preferences?: BuyerPreferences;                 // real-estate matching
  socials?: Record<string, string>; lastActivityAt?: Timestamp;
}

export interface Account extends SystemFields {
  name: string; type?: 'business' | 'household' | 'investor';
  industry?: string; website?: string; phone?: string;
  billingAddress?: Address; ownerId: ID; ownerName?: string;
  parentAccountId?: ID; employees?: number; revenue?: number;
  primaryContactId?: ID;
}

// ---- pipeline / deal ---------------------------------------------------------
export interface Stage {
  id: ID; name: string; probability: number; order: number;
  type?: 'open' | 'won' | 'lost';
}
export interface Pipeline {
  id: ID; name: string; entity: 'deal' | string; default?: boolean;
  stages: Stage[]; rottingDays?: number;
}

export type DealStatus = 'open' | 'won' | 'lost';
export interface LineItem {
  productId?: ID; name: string; qty: number; unitPrice: number;
  discount?: number; tax?: number; total: number;
}
export interface ContactRole { contactId: ID; role: string; }

export interface Deal extends SystemFields {
  name: string; accountId?: ID; accountName?: string;
  primaryContactId?: ID; primaryContactName?: string;
  pipelineId: ID; stageId: ID; stageName?: string;
  status: DealStatus; amount?: number; currency?: Currency;
  probability?: number; weightedAmount?: number;
  expectedCloseDate?: ISODate; closedAt?: Timestamp; stageChangedAt?: Timestamp;
  ownerId: ID; ownerName?: string; source?: LeadSource; lostReason?: string;
  nextStep?: string; lineItems?: LineItem[]; contactRoles?: ContactRole[];
  lastActivityAt?: Timestamp; rotting?: number; aiWinProbability?: number;
  fi?: DealFI;                                     // dealership F&I
}

// ---- activity / conversation -------------------------------------------------
export type ActivityType = 'task' | 'call' | 'meeting' | 'email' | 'note' | 'sms' | 'whatsapp';
export interface Activity extends SystemFields {
  type: ActivityType; subject: string; body?: string;
  status: 'open' | 'completed' | 'cancelled'; priority?: 'low' | 'normal' | 'high';
  dueAt?: Timestamp; completedAt?: Timestamp; durationMin?: number;
  direction?: 'inbound' | 'outbound';
  relatedTo: { type: string; id: ID; name?: string };
  ownerId: ID; ownerName?: string; assignedTo?: ID; outcome?: string;
  reminders?: Timestamp[]; attachments?: string[];
}

export type Channel = 'email' | 'whatsapp' | 'sms' | 'webchat' | 'messenger' | 'instagram';
export interface Conversation extends SystemFields {
  channel: Channel; status: 'open' | 'pending' | 'resolved' | 'snoozed';
  subject?: string; contactId?: ID; contactName?: string; leadId?: ID; dealId?: ID;
  assignedTo?: ID; assignedToName?: string; lastMessage?: string;
  lastMessageAt?: Timestamp; unreadByAgent?: number; unreadByContact?: number;
  externalThreadId?: string;
}
export interface Message {
  id: ID; from: 'agent' | 'contact' | 'bot' | 'system'; authorId?: ID; authorName?: string;
  text?: string; mediaUrls?: string[]; channel?: Channel;
  direction?: 'inbound' | 'outbound';
  status?: 'sent' | 'delivered' | 'read' | 'failed'; templateId?: string;
  timestamp: Timestamp; externalId?: string;
}

// ---- quotes / campaigns ------------------------------------------------------
export interface Quote extends SystemFields {
  dealId?: ID; contactId?: ID; number?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  lineItems: LineItem[]; subtotal: number; discount?: number; tax?: number; total: number;
  validUntil?: ISODate; terms?: string; pdfUrl?: string; signatureId?: string;
}
export interface Campaign extends SystemFields {
  name: string; type: 'email' | 'ads' | 'event' | 'webinar' | 'social';
  status: 'planned' | 'active' | 'done'; startDate?: ISODate; endDate?: ISODate;
  budget?: number; channel?: string; utm?: { source?: string; medium?: string; campaign?: string };
  metrics?: { sent?: number; opened?: number; clicked?: number; replied?: number; converted?: number; cost?: number };
}

// ---- audit / scoring ---------------------------------------------------------
export interface AuditLog {
  id: ID; orgId: ID; action: string; entityType: string; entityId: ID; entityName?: string;
  actorId?: ID; actorName?: string; changes?: { field: string; from: unknown; to: unknown }[];
  ip?: string; userAgent?: string; timestamp: Timestamp;
}
export interface ScoreFactor { key: string; label: string; points: number; }

// ---- automation rule ---------------------------------------------------------
export interface AutomationRule {
  id: ID; name: string; enabled: boolean; entity: string;
  trigger: { type: string; field?: string; cron?: string };
  conditions?: ConditionGroup; actions: AutomationAction[];
  limits?: { maxPerHour?: number; maxPerEvent?: number };
}
export interface ConditionGroup { all?: Condition[]; any?: Condition[]; }
export interface Condition { field: string; op: string; value?: unknown; }
export interface AutomationAction { type: string; [k: string]: unknown; }

// =============================================================================
// VERTICAL PACK — REAL ESTATE
// =============================================================================
export interface BuyerPreferences {
  operation?: 'venta' | 'arriendo'; types?: string[];
  minPrice?: number; maxPrice?: number; city?: string; neighborhoods?: string[];
  minBedrooms?: number; minBathrooms?: number; minArea?: number; minParking?: number;
  amenities?: string[]; stratum?: number[]; moveTimeline?: string;
}
export interface Property extends SystemFields {
  code?: string; mls?: string;
  type: 'casa' | 'apartamento' | 'lote' | 'oficina' | 'local' | 'bodega' | 'finca' | string;
  operation: 'venta' | 'arriendo' | 'venta_arriendo';
  status: 'disponible' | 'reservado' | 'vendido' | 'arrendado' | 'retirado';
  price: number; currency?: Currency; pricePerM2?: number; adminFee?: number;
  area?: number; builtArea?: number; lotArea?: number;
  bedrooms?: number; bathrooms?: number; parking?: number; floors?: number;
  stratum?: number; yearBuilt?: number; condition?: 'nuevo' | 'usado';
  address?: Address;
  amenities?: string[];
  media?: { photos?: string[]; video?: string; virtualTour?: string; floorPlan?: string };
  ownerContactId?: ID; exclusive?: boolean; commission?: number; coBroke?: number;
  listedAt?: Timestamp; daysOnMarket?: number; featured?: boolean;
  legal?: { matricula?: string; predial?: string };
}
export interface Showing {
  id: ID; propertyId: ID; contactId: ID; agentId: ID;
  scheduledAt: Timestamp; status: 'scheduled' | 'done' | 'no_show' | 'cancelled';
  feedback?: string; source?: string;
}

// =============================================================================
// VERTICAL PACK — AUTOMOTIVE DEALERSHIP
// =============================================================================
export interface Vehicle extends SystemFields {
  vin?: string; stockNumber?: string; condition: 'new' | 'used' | 'certified';
  make: string; model: string; year: number; trim?: string;
  bodyType?: 'sedan' | 'suv' | 'pickup' | 'hatchback' | 'camioneta' | string;
  mileage?: number; transmission?: string; fuel?: string; engine?: string;
  drivetrain?: string; doors?: number; seats?: number; color?: string; interior?: string;
  price: number; cost?: number; msrp?: number; currency?: Currency;
  status: 'disponible' | 'reservado' | 'vendido' | 'preparacion';
  location?: string; photos?: string[]; features?: string[]; description?: string;
  history?: { carfax?: string; owners?: number; accidents?: number };
  daysInInventory?: number; floorplan?: number; certifications?: string[];
  consignment?: boolean; consignorContactId?: ID;
}
export interface TestDrive {
  id: ID; vehicleId: ID; contactId: ID; salespersonId: ID;
  scheduledAt: Timestamp; status: 'scheduled' | 'done' | 'no_show' | 'cancelled';
  licenseCaptured?: boolean; route?: string; feedback?: string;
}
export interface TradeIn {
  id: ID; contactId: ID; dealId?: ID;
  vehicle: { vin?: string; make: string; model: string; year: number; mileage?: number; condition?: string; color?: string };
  valuation?: { source?: string; wholesale?: number; retail?: number; offer?: number };
  photos?: string[]; status?: string; payoff?: number; equity?: number;
}
export interface DealFI {
  tradeInId?: ID; downPayment?: number; term?: number; apr?: number;
  monthlyPayment?: number; lender?: string; products?: string[];
  status?: 'pending' | 'approved' | 'declined' | 'funded';
}
