export type UserRole = 'admin' | 'employee';
export type UserStatus = 'active' | 'panic' | 'offline';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastSeen: string;
  requestReporting?: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
  contacts?: {
    name: string;
    tel: string[];
  }[];
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  balance: number;
  nextPaymentDate: string;
  assignedEmployeeId?: string;
}

export interface CollectionRecord {
  id: string;
  employeeId: string;
  clientId: string;
  amount: number;
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface LocationHistory {
  id: string;
  uid: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: 'employee';
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  createdBy: string;
}
