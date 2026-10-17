import { useEffect, useState } from 'react';
import { Users2 } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { SectionTitle } from '../../components/ui/Primitives';
import { PostCard } from '../../components/ride/Cards';
import { EmptyState, LoadingState } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { CommunityPost } from '../../types';

const CATEGORIES = ['Touring', 'Adventure', 'Sports bikes', 'Cruisers', 'Scooters', 'Beginner riders', 'Long-distance riding', 'Local rides'];

export function CommunityScreen() {
  const { user } = useApp();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listCommunityPosts().then((p) => {
      setPosts(p);
      setLoading(false);
    });
  }, []);

  const post = async () => {
    if (!draft.trim() || !user) return;
    const newPost = await api.createPost({
      authorId: user.id,
      authorName: user.name,
      authorPhoto: user.photoUrl,
      category: 'Local rides',
      text: draft.trim(),
    });
    setPosts((p) => [newPost, ...p]);
    setDraft('');
  };

  return (
    <div className="rise-fade">
      <Header />
      <div className="px-4 md:px-6">
        <h1 className="font-display font-bold text-xl mb-4">Community</h1>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 no-scrollbar">
          {CATEGORIES.map((c) => (
            <span key={c} className="shrink-0 text-xs font-medium bg-asphalt-800 border border-asphalt-600 rounded-full px-3 py-1.5 text-asphalt-300">
              {c}
            </span>
          ))}
        </div>

        <div className="bg-asphalt-800 border border-asphalt-600 rounded-2xl p-4 mb-6">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share something with the community…"
            rows={2}
            className="w-full bg-transparent outline-none text-sm resize-none placeholder:text-asphalt-500"
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={post} disabled={!draft.trim()}>
              Post
            </Button>
          </div>
        </div>

        <SectionTitle>Latest from riders</SectionTitle>
        {loading ? (
          <LoadingState />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Users2 size={26} />}
            title="No posts yet"
            body="Be the first to share something with the Rider's Hub community."
          />
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
