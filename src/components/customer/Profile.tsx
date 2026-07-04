import React, { useState, useEffect } from "react";
import { ArrowLeft, LogOut, Award, User, Clock, Star, MapPin, ChevronRight, Bell, HelpCircle, Shield, Settings, Scissors, Sparkles, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

interface ProfileProps {
  navigateTo: (path: string) => void;
}

const Profile = ({ navigateTo }: ProfileProps) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  const [bookingsCount, setBookingsCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [debugInfo, setDebugInfo] = useState<{ userId: string; favCount: number | null }>({ userId: "Not Authenticated", favCount: null });

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setDebugInfo(prev => ({ ...prev, userId: user.id }));
        
        // Fetch profile
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (data) setProfile(data);

        // Fetch stats in parallel
        const [favsRes, reviewsRes, bookingsRes] = await Promise.all([
          supabase.from('customer_favourites').select('*', { count: 'exact', head: true }).eq('customer_id', user.id),
          supabase.from('customer_reviews').select('*', { count: 'exact', head: true }).eq('customer_id', user.id),
          supabase.from('customer_bookings').select('*', { count: 'exact', head: true }).eq('customer_id', user.id)
        ]);
        
        if (!favsRes.error) {
          setDebugInfo(prev => ({ ...prev, favCount: favsRes.count }));
        }

        if (!reviewsRes.error) {
          setReviewsCount(reviewsRes.count || 0);
        }

        if (!bookingsRes.error) {
          setBookingsCount(bookingsRes.count || 0);
          
          // Also count completed bookings
          const { count: compCount } = await supabase
            .from('customer_bookings')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', user.id)
            .eq('status', 'completed');
          
          setCompletedCount(compCount || 0);
        }
      }
      setLoading(false);
    }
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigateTo("/login");
  };

  const menuItems = [
    { icon: User, label: "Edit Profile", path: "/profile/edit" },
    { icon: Clock, label: "My Bookings", path: "/my-bookings" },
    { icon: Star, label: "Rewards", path: "/rewards" },
    { icon: Bell, label: "Notifications", path: "/notifications" },
    { icon: HelpCircle, label: "Help & Support", path: "/support" },
    { icon: Shield, label: "Privacy & Terms", path: "/privacy" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <TopBar 
        title="My Profile" 
        onBack={() => navigateTo("/customer")} 
        showHome={true}
        onHome={() => navigateTo("/customer")}
        showMainSite={true}
        onMainSite={() => navigateTo("/")}
      />

      <div className="px-4 py-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black text-xl overflow-hidden border border-slate-100">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name ? profile.full_name[0] : "N"
                )}
            </div>
            <div className="flex-1">
                <h2 className="font-bold text-slate-900">{profile?.full_name || "Nexora Customer"}</h2>
                <p className="text-xs text-slate-500">{profile?.email || "No email"}</p>
                <p className="text-[10px] text-blue-600 font-bold mt-1">Customer</p>
            </div>
        </div>

        {/* Verification Debug Section */}
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm">
            <h3 className="text-[10px] text-amber-800 font-bold uppercase mb-2">Supabase Verification</h3>
            <div className="space-y-1">
                <p className="text-[10px] text-slate-600">
                    <span className="font-bold">Profile ID:</span> {debugInfo.userId}
                </p>
                <p className="text-[10px] text-slate-600">
                    <span className="font-bold">Favourites Count:</span> {debugInfo.favCount !== null ? (debugInfo.favCount === -1 ? "Error" : debugInfo.favCount) : "Loading..."}
                </p>
            </div>
        </div>

        {/* Membership Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-3xl text-white shadow-lg">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-[10px] opacity-80 font-bold uppercase">Current Level</p>
                    <p className="font-black text-xl">Gold Member</p>
                </div>
                <Award className="w-8 h-8 text-amber-300" />
            </div>
            <div className="flex justify-between items-end">
                <div>
                    <p className="text-[10px] opacity-80 font-bold">Reward Points</p>
                    <p className="font-black text-2xl">1,250</p>
                </div>
                <button onClick={() => navigateTo("/rewards")} className="px-4 py-2 bg-white/20 rounded-xl text-[10px] font-bold">View Rewards</button>
            </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
            {[
              {label: "Total Bookings", val: bookingsCount.toString()}, 
              {label: "Completed Visits", val: completedCount.toString()}, 
              {label: "Favourite Salons", val: (debugInfo.favCount || 0).toString()}, 
              {label: "Reviews Given", val: reviewsCount.toString()}
            ].map(stat => (
                <div key={stat.label} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] text-slate-500 font-bold">{stat.label}</p>
                    <p className="font-black text-lg text-slate-900">{stat.val}</p>
                </div>
            ))}
        </div>

        {/* Favourites */}
        <div>
            <h3 className="font-bold text-slate-900 text-sm mb-3">Favourite Salons</h3>
            <div className="space-y-2">
                {["Chique Salon & Luxury Spa", "Royal Touch Salon", "Urban Bloom Beauty Studio"].map(s => (
                    <div key={s} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><Scissors className="w-4 h-4 text-slate-600" /></div>
                            <span className="text-xs font-bold text-slate-900">{s}</span>
                        </div>
                        <button onClick={() => navigateTo("/salon/demo")} className="text-[10px] font-bold text-blue-600">View</button>
                    </div>
                ))}
            </div>
        </div>

        {/* Account Options */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-8">
            {menuItems.map(item => (
                <button key={item.label} onClick={() => navigateTo(item.path)} className="w-full p-4 flex items-center justify-between border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                        <item.icon className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
            ))}
            <button onClick={handleLogout} className="w-full p-4 flex items-center justify-between border-t border-slate-50 hover:bg-rose-50 transition-colors">
                <div className="flex items-center gap-3">
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-rose-600">Logout</span>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-300" />
            </button>
        </div>
      </div>

      <BottomNav currentPath="/profile" navigateTo={navigateTo} />
    </div>
  );
};

export default Profile;
