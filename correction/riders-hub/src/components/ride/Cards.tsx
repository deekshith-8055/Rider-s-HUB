import { Calendar, Clock, MapPin, Users, Star, ChevronRight } from 'lucide-react';
import type { Business, CommunityPost, Ride, RiderEvent, AppNotification } from '../../types';
import { Card, Avatar, Badge } from '../ui/Primitives';
import { PlaceMarker } from '../map/Markers';
import { formatTimeAgo } from '../../utils/format';

export function RideCard({ ride, onClick, riderCount }: { ride: Ride; onClick?: () => void; riderCount?: number }) {
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-semibold text-base text-asphalt-100">{ride.name}</p>
          <p className="text-xs text-asphalt-400 mt-0.5 flex items-center gap-1">
            <MapPin size={12} /> {ride.origin.label} → {ride.destination.label}
          </p>
        </div>
        <Badge variant={ride.visibility === 'public' ? 'gps' : 'neutral'}>{ride.visibility}</Badge>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-asphalt-300">
        <span className="flex items-center gap-1">
          <Calendar size={12} /> {ride.date}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {ride.startTime}
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} /> {riderCount ?? 0}/{ride.maxRiders}
        </span>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-asphalt-700">
        <span className="font-mono text-xs text-ember-400 tracking-wide">{ride.code}</span>
        <ChevronRight size={16} className="text-asphalt-500" />
      </div>
    </Card>
  );
}

export function BusinessCard({ business, onClick }: { business: Business; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className="p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-asphalt-700 flex items-center justify-center">
        <PlaceMarker category={business.category} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-asphalt-100 truncate">{business.name}</p>
        <p className="text-xs text-asphalt-400 truncate">{business.address}</p>
      </div>
      <div className="text-right shrink-0">
        {business.rating && (
          <span className="flex items-center gap-1 text-xs text-signal-amber font-semibold">
            <Star size={12} fill="currentColor" /> {business.rating}
          </span>
        )}
        <Badge variant={business.isOpenNow ? 'gps' : 'neutral'} className="mt-1">
          {business.isOpenNow ? 'Open' : 'Closed'}
        </Badge>
      </div>
    </Card>
  );
}

export function EventCard({ event, onClick, joined }: { event: RiderEvent; onClick?: () => void; joined?: boolean }) {
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="ember">{event.category}</Badge>
          <p className="font-display font-semibold text-base text-asphalt-100 mt-1.5">{event.name}</p>
        </div>
      </div>
      <p className="text-xs text-asphalt-400 mt-2 flex items-center gap-1">
        <Calendar size={12} /> {event.date} · <MapPin size={12} /> {event.location.label}
      </p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-asphalt-700">
        <span className="text-xs text-asphalt-300">{event.attendeeIds.length} attending</span>
        <Badge variant={joined ? 'gps' : 'neutral'}>{joined ? 'Going' : 'Organizer: ' + event.organizerName}</Badge>
      </div>
    </Card>
  );
}

export function PostCard({ post }: { post: CommunityPost }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5">
        <Avatar name={post.authorName} photoUrl={post.authorPhoto} size={34} />
        <div>
          <p className="text-sm font-semibold text-asphalt-100">{post.authorName}</p>
          <p className="text-[0.68rem] text-asphalt-400">
            {formatTimeAgo(post.createdAt)} · <span className="text-gps-400">{post.category}</span>
          </p>
        </div>
      </div>
      <p className="text-sm text-asphalt-200 mt-3 leading-relaxed">{post.text}</p>
      <div className="flex items-center gap-4 mt-3 text-xs text-asphalt-400">
        <span>♥ {post.likeCount}</span>
        <span>💬 {post.commentCount}</span>
      </div>
    </Card>
  );
}

export function NotificationCard({ notif, onClick }: { notif: AppNotification; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={`p-4 ${notif.read ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-asphalt-100">{notif.title}</p>
        {!notif.read && <span className="w-2 h-2 rounded-full bg-ember-500 mt-1.5 shrink-0" />}
      </div>
      <p className="text-xs text-asphalt-400 mt-1">{notif.body}</p>
      <p className="text-[0.65rem] text-asphalt-500 mt-2">{formatTimeAgo(notif.createdAt)}</p>
    </Card>
  );
}
