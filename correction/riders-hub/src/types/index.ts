// ---------------------------------------------------------------------------
// Rider's Hub — core domain types
// ---------------------------------------------------------------------------

export type UserRole = 'rider' | 'ride_leader' | 'business' | 'admin';

export interface RiderPreferences {
  bikeType?: string;
  ridingStyle?: string[]; // e.g. ["touring", "adventure"]
}

export interface AppUser {
  id: string;
  name: string;
  username: string;
  bio?: string;
  photoUrl?: string;
  role: UserRole;
  preferences?: RiderPreferences;
  stats: RiderStats;
  achievements: string[]; // achievement ids unlocked
  joinedCommunities: string[];
  createdAt: number;
}

export interface RiderStats {
  totalRides: number;
  totalDistanceKm: number;
  totalRidingMinutes: number;
  ridersConnected: number;
  maxSpeedKmh: number;
}

export type RideVisibility = 'public' | 'private';
export type RideLifecycle = 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface NamedPoint extends GeoPoint {
  label: string;
}

export interface Ride {
  id: string;
  code: string; // e.g. RH-7K29X
  name: string;
  description?: string;
  leaderId: string;
  origin: NamedPoint;
  destination: NamedPoint;
  waypoints: NamedPoint[];
  meetingPoint?: NamedPoint;
  date: string; // ISO date
  startTime: string; // HH:mm
  maxRiders: number;
  visibility: RideVisibility;
  status: RideLifecycle;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
}

export type RiderRideStatus =
  | 'riding'
  | 'slow_down'
  | 'stopped'
  | 'fuel_stop'
  | 'food_stop'
  | 'mechanical_issue'
  | 'emergency'
  | 'photo_stop'
  | 'destination_reached';

export interface RideParticipant {
  rideId: string;
  userId: string;
  name: string;
  photoUrl?: string;
  role: 'leader' | 'participant';
  joinedAt: number;
  status: RiderRideStatus;
  isOnline: boolean;
}

export interface LiveLocation {
  userId: string;
  rideId?: string;
  lat: number;
  lng: number;
  speedKmh: number;
  headingDeg: number;
  timestamp: number;
  isOnline: boolean;
  /** Rider's display name — populated for Realtime Database ride-room sync (rides/{rideId}/riders/{userId}). */
  name?: string;
}

export type MessageKind = 'text' | 'quick' | 'announcement' | 'status';

export interface RideMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderName: string;
  kind: MessageKind;
  text: string;
  createdAt: number;
}

export interface RideEventLog {
  id: string;
  rideId: string;
  type:
    | 'ride_started'
    | 'ride_paused'
    | 'ride_resumed'
    | 'ride_ended'
    | 'rider_joined'
    | 'rider_left'
    | 'rider_removed'
    | 'status_update'
    | 'waypoint_added'
    | 'emergency_triggered';
  actorId: string;
  actorName: string;
  detail?: string;
  createdAt: number;
}

export type BusinessCategory =
  | 'petrol'
  | 'ev_charging'
  | 'mechanic'
  | 'tyre_shop'
  | 'restaurant'
  | 'cafe'
  | 'hotel'
  | 'bike_service'
  | 'accessories'
  | 'hospital'
  | 'other';

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  category: BusinessCategory;
  address: string;
  location: GeoPoint;
  phone?: string;
  contactName?: string;
  website?: string;
  openingHours?: string;
  description?: string;
  services?: string[];
  photos?: string[];
  isOpenNow?: boolean;
  rating?: number;
  offers?: string[];
}

export interface RiderEvent {
  id: string;
  name: string;
  organizerId: string;
  organizerName: string;
  date: string;
  location: NamedPoint;
  description: string;
  attendeeIds: string[];
  category: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  category: string;
  text: string;
  createdAt: number;
  likeCount: number;
  commentCount: number;
}

export interface Community {
  id: string;
  name: string;
  category: string;
  memberCount: number;
  description: string;
}

export interface SavedRideSummary {
  id: string;
  rideId?: string;
  name: string;
  distanceKm: number;
  durationMinutes: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  riderCount: number;
  startedAt: number;
  endedAt: number;
  route: GeoPoint[];
  stops: number;
  origin: string;
  destination: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type:
    | 'ride_invite'
    | 'ride_starting'
    | 'rider_joined'
    | 'rider_left'
    | 'announcement'
    | 'emergency'
    | 'event'
    | 'business';
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
}

export type NetworkState = 'online' | 'offline' | 'connecting' | 'server_error';
export type LocationState = 'idle' | 'granted' | 'denied' | 'unavailable' | 'revoked';

export interface OfflineQueueItem {
  id: string;
  kind: 'location' | 'message' | 'status' | 'ride_event';
  payload: unknown;
  createdAt: number;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'rider' | 'post' | 'business' | 'event' | 'message';
  targetId: string;
  category: 'spam' | 'abuse' | 'fake_business' | 'dangerous_behavior' | 'inappropriate' | 'other';
  note?: string;
  createdAt: number;
  status: 'open' | 'reviewed' | 'dismissed';
}
