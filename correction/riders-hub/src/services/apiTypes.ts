import type {
  AppUser,
  Business,
  CommunityPost,
  LiveLocation,
  Ride,
  RideEventLog,
  RideMessage,
  RideParticipant,
  RiderEvent,
  RiderRideStatus,
  SavedRideSummary,
  AppNotification,
} from '../types';

/**
 * RiderHubDataService is the single contract that every backend
 * implementation (mock / Firebase) must satisfy. Screens and hooks are only
 * ever written against this interface, never against a concrete backend, so
 * swapping demo mode for production Firebase is a one-line change
 * (see services/api.ts).
 */
export interface RiderHubDataService {
  // Auth / users
  getCurrentUser(): Promise<AppUser | null>;
  signIn(email: string, password: string): Promise<AppUser>;
  signUp(name: string, email: string, password: string): Promise<AppUser>;
  signInWithGoogle(): Promise<AppUser>;
  signOut(): Promise<void>;
  updateProfile(userId: string, patch: Partial<AppUser>): Promise<AppUser>;

  // Rides
  createRide(input: Omit<Ride, 'id' | 'code' | 'status' | 'createdAt' | 'waypoints'> & { waypoints?: Ride['waypoints'] }): Promise<Ride>;
  getRideByCode(code: string): Promise<Ride | null>;
  getRide(rideId: string): Promise<Ride | null>;
  listMyRides(userId: string): Promise<Ride[]>;
  listPublicRides(): Promise<Ride[]>;
  joinRide(rideId: string, user: AppUser): Promise<RideParticipant>;
  leaveRide(rideId: string, userId: string): Promise<void>;
  removeParticipant(rideId: string, userId: string, actorId: string): Promise<void>;
  listParticipants(rideId: string): Promise<RideParticipant[]>;
  subscribeToParticipants(rideId: string, cb: (participants: RideParticipant[]) => void): () => void;
  startRide(rideId: string): Promise<Ride>;
  pauseRide(rideId: string): Promise<Ride>;
  endRide(rideId: string, summary: Omit<SavedRideSummary, 'id'>): Promise<SavedRideSummary>;
  updateRiderStatus(rideId: string, userId: string, status: RiderRideStatus): Promise<void>;

  // Locations
  pushLocation(loc: LiveLocation): Promise<void>;
  subscribeToRideLocations(rideId: string, cb: (locations: LiveLocation[]) => void): () => void;

  // Messages
  sendMessage(msg: Omit<RideMessage, 'id' | 'createdAt'>): Promise<RideMessage>;
  subscribeToMessages(rideId: string, cb: (messages: RideMessage[]) => void): () => void;

  // Ride event log
  logEvent(evt: Omit<RideEventLog, 'id' | 'createdAt'>): Promise<void>;
  subscribeToEvents(rideId: string, cb: (events: RideEventLog[]) => void): () => void;

  // Ride history
  listSavedRides(userId: string): Promise<SavedRideSummary[]>;

  // Businesses
  listBusinesses(category?: string): Promise<Business[]>;
  registerBusiness(input: Omit<Business, 'id'>): Promise<Business>;
  updateBusiness(businessId: string, patch: Partial<Business>): Promise<Business>;

  // Events / community
  listEvents(): Promise<RiderEvent[]>;
  joinEvent(eventId: string, userId: string): Promise<void>;
  listCommunityPosts(): Promise<CommunityPost[]>;
  createPost(input: Omit<CommunityPost, 'id' | 'createdAt' | 'likeCount' | 'commentCount'>): Promise<CommunityPost>;

  // Notifications
  listNotifications(userId: string): Promise<AppNotification[]>;
  markNotificationRead(notificationId: string): Promise<void>;

  // Nearby riders (for demo/home)
  listNearbyRiders(): Promise<LiveLocation[]>;
}
