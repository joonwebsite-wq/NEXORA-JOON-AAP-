import React, { useState, useEffect } from "react";
import { ArrowLeft, Sparkles, Search, Clock, Star, User, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import LoadingState from "./LoadingState";

interface MyBookingsProps {
  navigateTo: (path: string) => void;
}

const MyBookings = ({ navigateTo }: MyBookingsProps) => {
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("customer_bookings")
        .select(`
          *,
          shops (shop_name, area, city),
          shop_staff (staff_name)
        `)
        .eq("customer_id", session.user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setBookings(data || []);
    } catch (err: any) {
      console.error("Error fetching bookings:", err);
      setError(err.message || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (activeTab === "Upcoming") return b.status === "pending" || b.status === "confirmed";
    if (activeTab === "Completed") return b.status === "completed";
    if (activeTab === "Cancelled") return b.status === "cancelled" || b.status === "no_show";
    return true;
  });

  if (loading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      <TopBar 
        title="My Bookings" 
        subtitle="Manage your salon appointments"
        onBack={() => navigateTo("/customer")} 
        showHome={true}
        onHome={() => navigateTo("/customer")}
        showMainSite={true}
        onMainSite={() => navigateTo("/")}
      />

      <section className="px-4 py-4 flex gap-2 overflow-x-auto no-scrollbar">
        {["Upcoming", "Completed", "Cancelled"].map(tab => (
            <button 
                key={tab} 
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold rounded-full border ${activeTab === tab ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
            >
                {tab}
            </button>
        ))}
      </section>

      <div className="px-4 pb-4 space-y-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((b) => (
              <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 animate-fade-in">
                  <div className="flex justify-between items-center">
                      <div>
                          <p className="font-bold text-slate-900 text-sm">{b.shops?.shop_name || "Salon"}</p>
                          <p className="text-[10px] text-slate-400">{b.shops?.area}, {b.shops?.city}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' :
                        b.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                        b.status === 'completed' ? 'bg-blue-50 text-blue-600' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
                      <p className="text-slate-500">Staff: {b.shop_staff?.staff_name || "Any Available Expert"}</p>
                      <p className="text-slate-500 font-bold">{new Date(b.booking_date).toLocaleDateString()} • {b.booking_time}</p>
                      <p className="font-black text-slate-900">₹{b.total_amount}</p>
                  </div>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => navigateTo(`/booking/details/${b.id}`)} 
                        className="flex-1 py-2 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                      >
                        Details
                      </button>
                      {(b.status === 'pending' || b.status === 'confirmed') && (
                        <>
                          <button onClick={() => navigateTo(`/booking/details/${b.id}`)} className="flex-1 py-2 text-[10px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition">Reschedule</button>
                          <button onClick={() => navigateTo(`/booking/details/${b.id}`)} className="flex-1 py-2 text-[10px] font-bold border border-rose-100 text-rose-600 rounded-lg hover:bg-rose-50 transition">Cancel</button>
                        </>
                      )}
                      {(b.status === 'completed' || b.status === 'cancelled') && (
                        <button 
                          onClick={() => navigateTo(`/booking/${b.shop_id}`)} 
                          className="flex-1 py-2 text-[10px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          Book Again
                        </button>
                      )}
                  </div>
              </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">No bookings found</h3>
            <p className="text-xs text-slate-500 mb-6">You don't have any {activeTab.toLowerCase()} appointments.</p>
            <button 
              onClick={() => navigateTo("/customer")}
              className="text-blue-600 font-bold text-xs"
            >
              Explore Salons
            </button>
          </div>
        )}
      </div>

      <BottomNav currentPath="/my-bookings" navigateTo={navigateTo} />
    </div>
  );
};

export default MyBookings;
