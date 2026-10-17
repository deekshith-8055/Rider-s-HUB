import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { LiveLocation, RideEventLog, RideMessage, RideParticipant } from '../types';

export function useRideLocations(rideId: string | undefined) {
  const [locations, setLocations] = useState<LiveLocation[]>([]);
  useEffect(() => {
    if (!rideId) return;
    const unsub = api.subscribeToRideLocations(rideId, setLocations);
    return unsub;
  }, [rideId]);
  return locations;
}

export function useRideParticipants(rideId: string | undefined) {
  const [participants, setParticipants] = useState<RideParticipant[]>([]);
  useEffect(() => {
    if (!rideId) return;
    const unsub = api.subscribeToParticipants(rideId, setParticipants);
    return unsub;
  }, [rideId]);
  return participants;
}

export function useRideMessages(rideId: string | undefined) {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  useEffect(() => {
    if (!rideId) return;
    const unsub = api.subscribeToMessages(rideId, setMessages);
    return unsub;
  }, [rideId]);
  return messages;
}

export function useRideEvents(rideId: string | undefined) {
  const [events, setEvents] = useState<RideEventLog[]>([]);
  useEffect(() => {
    if (!rideId) return;
    const unsub = api.subscribeToEvents(rideId, setEvents);
    return unsub;
  }, [rideId]);
  return events;
}
