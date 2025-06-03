import React, { useState } from 'react';
import { adminDashboardTabs } from './AdminDashboardTabs';
import AdminTickets from './AdminTickets';
import AdminChatList from './AdminChatList';
import CompetitionManagement from './CompetitionManagement';
import PlayerManagement from './PlayerManagement';
import TeamManagement from './TeamManagement';
import AdminRequests from './AdminRequests';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface SocialPost {
  id: string;
  title: string;
  image_url: string;
  post_url: string;
  active: boolean;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('tickets');
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    image_url: '',
    post_url: ''
  });

  React.useEffect(() => {
    if (activeTab === 'social') {
      fetchSocialPosts();
    }
  }, [activeTab]);

  const fetchSocialPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSocialPosts(data || []);
    } catch (error) {
      console.error('Error fetching social posts:', error);
      toast.error('Error loading social posts');
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('social_posts')
        .insert({
          title: newPost.title,
          image_url: newPost.image_url,
          post_url: newPost.post_url,
          active: true
        });

      if (error) throw error;

      toast.success('Post created successfully');
      setIsCreatePostModalOpen(false);
      setNewPost({ title: '', image_url: '', post_url: '' });
      fetchSocialPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Error creating post');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePostStatus = async (postId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('social_posts')
        .update({ active: !currentStatus })
        .eq('id', postId);

      if (error) throw error;

      toast.success(`Post ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      fetchSocialPosts();
    } catch (error) {
      console.error('Error updating post status:', error);
      toast.error('Error updating post status');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tickets':
        return <AdminTickets />;
      case 'chats':
        return <AdminChatList />;
      case 'teams':
        return <TeamManagement />;
      case 'tournaments':
        return <CompetitionManagement />;
      case 'players':
        return <PlayerManagement />;
      case 'requests':
        return <AdminRequests />;
      case 'social':
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Social Posts</h2>
              <button
                onClick={() => setIsCreatePostModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus size={20} />
                <span>Create Post</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {socialPosts.map(post => (
                <div key={post.id} className="bg-gray-700 rounded-lg overflow-hidden">
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
                    <div className="flex items-center justify-between">
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View Post
                      </a>
                      <button
                        onClick={() => handleTogglePostStatus(post.id, post.active)}
                        className={`px-3 py-1 rounded-full text-sm ${
                          post.active
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-600 hover:bg-gray-500'
                        }`}
                      >
                        {post.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Create Post Modal */}
            {isCreatePostModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                  <h3 className="text-xl font-semibold mb-4">Create Social Post</h3>
                  <form onSubmit={handleCreatePost} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={newPost.title}
                        onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 rounded-lg"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Image URL
                      </label>
                      <input
                        type="url"
                        value={newPost.image_url}
                        onChange={(e) => setNewPost({ ...newPost, image_url: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 rounded-lg"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Post URL
                      </label>
                      <input
                        type="url"
                        value={newPost.post_url}
                        onChange={(e) => setNewPost({ ...newPost, post_url: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 rounded-lg"
                        required
                      />
                    </div>

                    <div className="flex space-x-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg disabled:opacity-50"
                      >
                        {isLoading ? 'Creating...' : 'Create Post'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatePostModalOpen(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Admin Dashboard</h1>
      
      <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
        {adminDashboardTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap
              ${activeTab === key 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}
            `}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}