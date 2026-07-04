import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { Sparkles, Search, Bell, MapPin, User, LogOut, Star, Mic, Zap, ShieldCheck, QrCode, Clock, Percent, Menu, AlertCircle } from "lucide-react";
import BottomNav from "./BottomNav";
import LoadingState from "./LoadingState";
import TopBar from "./TopBar";
import { Shop } from "../../types";
import { getShopImage } from "../../lib/shopUtils";

interface CustomerHomeProps {
  navigateTo: (path: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  hair_salon: "Hair Salon",
  beauty_parlour: "Beauty Parlour",
  barber: "Barber",
  spa: "Spa",
  massage: "Massage",
  tattoo: "Tattoo",
  nail_art: "Nail Art"
};

const matchesAudience = (category: string, audience: string): boolean => {
  if (audience === "Men") {
    return category === "barber" || ["hair_salon", "spa", "massage", "tattoo"].includes(category);
  }
  if (audience === "Women") {
    return ["beauty_parlour", "nail_art"].includes(category) || ["hair_salon", "spa", "massage", "tattoo"].includes(category);
  }
  if (audience === "Child") {
    return ["hair_salon", "spa", "massage", "tattoo"].includes(category);
  }
  if (audience === "Unisex") {
    return ["hair_salon", "spa", "massage", "tattoo"].includes(category);
  }
  return true;
};

const CustomerHome = ({ navigateTo }: CustomerHomeProps) => {
  const [profile, setProfile] = useState<any>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopServices, setShopServices] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // 1. Fetch Profile
        if (user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, email, phone, city, area, role")
            .eq("id", user.id)
            .single();
          
          if (profileData) setProfile(profileData);
        }

        // 2. Fetch Shops
        const { data: shopsData, error: shopsError } = await supabase
          .from("shops")
          .select("*")
          .eq("is_active", true);
        
        if (shopsError) throw shopsError;
        
        if (shopsData) {
          // Sort verified first, then rating, then price
          const sortedShops = [...shopsData].sort((a, b) => {
            if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
            if (b.rating !== a.rating) return b.rating - a.rating;
            return a.starting_price - b.starting_price;
          });
          setShops(sortedShops);
        }

        // 3. Fetch Shop Services
        let servicesMap: Record<string, string[]> = {};
        try {
          const { data: sData } = await supabase
            .from("shop_services")
            .select("shop_id, service_name")
            .eq("is_active", true);
          if (sData) {
            sData.forEach((srv: any) => {
              if (!servicesMap[srv.shop_id]) {
                servicesMap[srv.shop_id] = [];
              }
              servicesMap[srv.shop_id].push(srv.service_name);
            });
          }
        } catch (serviceErr) {
          console.error("Error fetching shop services:", serviceErr);
        }
        setShopServices(servicesMap);

      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError("Unable to load salons. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigateTo("/login");
  };

  const categories = Object.values(CATEGORY_LABELS);
  const audienceOptions = ["Men", "Women", "Child", "Unisex"];
  const quickFilters = ["Nearby", "Top Rated", "Open Now", "Offers", "Price Low to High"];
  
  const benefits = [
    { icon: ShieldCheck, label: "Verified Salons" },
    { icon: Zap, label: "60s Booking" },
    { icon: Percent, label: "Price Transparency" },
    { icon: QrCode, label: "Rewards on QR" },
  ];

  const handleUseMyLocation = () => {
    setLocationMessage("Location detection will be connected later.");
    setTimeout(() => {
      setLocationMessage(null);
    }, 4000);
  };

  const showingNearText = useMemo(() => {
    if (locationSearch.trim()) {
      return `Showing salons near “${locationSearch.trim()}”`;
    }
    if (profile?.area || profile?.city) {
      const parts = [profile.area, profile.city].filter(Boolean);
      return `Showing salons near ${parts.join(", ")}`;
    }
    return "Showing salons across Jaipur";
  }, [locationSearch, profile]);

  const isAnyFilterActive = useMemo(() => {
    return !!(searchQuery || locationSearch || selectedCategory || selectedAudience || selectedFilter);
  }, [searchQuery, locationSearch, selectedCategory, selectedAudience, selectedFilter]);

  const filteredShops = useMemo(() => {
    let result = shops;

    // 1. Search Query Match
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(s => {
        const shopCategoryLabel = CATEGORY_LABELS[s.category] || s.category;
        const nameMatch = s.shop_name.toLowerCase().includes(query);
        const catMatch = shopCategoryLabel.toLowerCase().includes(query);
        const descMatch = s.description ? s.description.toLowerCase().includes(query) : false;

        // Match service names from shop_services
        const services = shopServices[s.id] || [];
        const serviceMatch = services.some(srvName => srvName.toLowerCase().includes(query));

        // Match audience tag: Men, Women, Child, Unisex
        const matchesMenAudience = query === "men" && (s.category === "barber" || ["hair_salon", "spa", "massage", "tattoo"].includes(s.category));
        const matchesWomenAudience = query === "women" && (["beauty_parlour", "nail_art"].includes(s.category) || ["hair_salon", "spa", "massage", "tattoo"].includes(s.category));
        const matchesChildAudience = query === "child" && ["hair_salon", "spa", "massage", "tattoo"].includes(s.category);
        const matchesUnisexAudience = query === "unisex" && ["hair_salon", "spa", "massage", "tattoo"].includes(s.category);

        return nameMatch || catMatch || descMatch || serviceMatch || matchesMenAudience || matchesWomenAudience || matchesChildAudience || matchesUnisexAudience;
      });
    }

    // 2. Category Match
    if (selectedCategory) {
      result = result.filter(s => {
        const shopCategoryLabel = CATEGORY_LABELS[s.category] || s.category;
        return shopCategoryLabel === selectedCategory;
      });
    }

    // 3. Location Search Match
    if (locationSearch) {
      const locQuery = locationSearch.toLowerCase().trim();
      result = result.filter(s => {
        const areaMatch = s.area ? s.area.toLowerCase().includes(locQuery) : false;
        const cityMatch = s.city ? s.city.toLowerCase().includes(locQuery) : false;
        const addressMatch = s.address ? s.address.toLowerCase().includes(locQuery) : false;
        const nameMatch = s.shop_name ? s.shop_name.toLowerCase().includes(locQuery) : false;
        return areaMatch || cityMatch || addressMatch || nameMatch;
      });
    }

    // 4. Audience Match
    if (selectedAudience) {
      result = result.filter(s => matchesAudience(s.category, selectedAudience));
    }

    // 5. Quick Filters Match
    if (selectedFilter === "Top Rated") {
      result = [...result].sort((a, b) => b.rating - a.rating);
    } else if (selectedFilter === "Open Now") {
      result = result.filter(s => s.is_open);
    } else if (selectedFilter === "Offers") {
      result = []; // UI filter only, show empty state if no offer data
    } else if (selectedFilter === "Price Low to High") {
      result = [...result].sort((a, b) => a.starting_price - b.starting_price);
    }

    return result;
  }, [shops, searchQuery, locationSearch, selectedCategory, selectedAudience, selectedFilter, shopServices]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Error</h2>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs font-sans"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <TopBar 
        title="Nexora" 
        showBack={false}
        showMainSite={true}
        onMainSite={() => navigateTo("/")}
        showLogout={true}
        onLogout={handleLogout}
      />

      <div className="max-w-5xl mx-auto">
        <section className="p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Hi, {profile?.full_name || "Nexora User"}</h2>
          <p className="text-slate-500 text-sm mb-4">Salon ja rahe ho? Nexora kiya kya?</p>
          <p className="text-xs text-blue-600 font-bold flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {showingNearText}
          </p>
        </section>

        {/* Search & Location Selection Container */}
        <section className="px-6 mb-6 space-y-4">
          {/* Main search bar */}
          <div className="relative bg-white rounded-3xl p-2 shadow-sm border border-slate-100 flex items-center">
            <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 text-sm focus:outline-none bg-transparent" 
              placeholder="Search salon, service, category..." 
            />
            <button className="p-2 text-slate-400 hover:text-blue-600"><Mic className="w-5 h-5" /></button>
          </div>

          {/* Location input and 'Use My Location' CTA */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Location Search / Area Input</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center p-1">
                <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                <input 
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-transparent focus:outline-none" 
                  placeholder="Enter area, landmark, or city" 
                />
              </div>
              <button 
                type="button"
                onClick={handleUseMyLocation}
                className="w-full sm:w-auto px-5 py-3.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                Use My Location
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">
                Example: Jhotwara, Mansarovar, Jaipur, near me
              </span>
              {locationMessage && (
                <span className="text-[11px] text-blue-600 font-bold animate-fade-in flex items-center gap-1">
                  ✨ {locationMessage}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Category horizontal chips scroll */}
        <section className="px-6 mb-4">
          <div className="text-3xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
            Categories
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 no-scrollbar">
            {categories.map(c => (
              <button 
                key={c} 
                onClick={() => setSelectedCategory(selectedCategory === c ? null : c)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${selectedCategory === c ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* Audience horizontal chips scroll */}
        <section className="px-6 mb-4">
          <div className="text-3xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
            Audience
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 no-scrollbar">
            {audienceOptions.map(aud => (
              <button 
                key={aud} 
                onClick={() => setSelectedAudience(selectedAudience === aud ? null : aud)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${selectedAudience === aud ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200'}`}
              >
                {aud}
              </button>
            ))}
          </div>
        </section>

        {/* Quick filters scroll */}
        <section className="px-6 mb-6">
          <div className="text-3xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
            Quick Filters
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 no-scrollbar">
            {quickFilters.map(f => (
              <button 
                key={f} 
                onClick={() => setSelectedFilter(selectedFilter === f ? null : f)}
                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${selectedFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </section>

        <section className="px-6 mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {benefits.map((b, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center gap-2">
              <b.icon className="w-6 h-6 text-blue-600" />
              <span className="text-[10px] font-bold text-slate-700">{b.label}</span>
            </div>
          ))}
        </section>

        <section className="px-6 space-y-4 pb-10">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest">
              {filteredShops.length} {filteredShops.length === 1 ? "Salon" : "Salons"} Found
            </h3>
            {isAnyFilterActive && (
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setLocationSearch("");
                  setSelectedCategory(null);
                  setSelectedAudience(null);
                  setSelectedFilter(null);
                  setLocationMessage(null);
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          {filteredShops.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShops.map((s) => (
                <div key={s.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                  <div className="relative h-44 bg-slate-100">
                    <img 
                      src={getShopImage(s)} 
                      alt={s.shop_name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      {s.is_verified && (
                        <span className="bg-blue-600 text-white px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      )}
                      {s.is_open ? (
                        <span className="bg-emerald-500 text-white px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">Open</span>
                      ) : (
                        <span className="bg-slate-500 text-white px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">Closed</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-blue-600 transition-colors">{s.shop_name}</h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-wide">
                          {CATEGORY_LABELS[s.category] || s.category} • {s.area}
                        </p>
                      </div>
                      <div className="bg-amber-50 text-amber-600 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                        <Star className="w-3 h-3 fill-amber-600" />
                        <span className="text-xs font-bold">{s.rating}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                      {s.description || "Premium beauty and grooming services at Nexora partner salon."}
                    </p>

                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Starting from</p>
                        <p className="font-black text-slate-900">₹{s.starting_price}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Location</p>
                         <p className="text-[10px] font-bold text-slate-700">{s.city}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => navigateTo(`/salon/${s.id}`)} 
                        className="flex-1 py-3 text-xs font-bold border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        View Details
                      </button>
                      <button 
                        onClick={() => navigateTo(`/booking/${s.id}`)} 
                        className="flex-1 py-3 text-xs font-bold bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 cursor-pointer"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4">
                <Search className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No salons found</h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">Try another area, category, or search keyword.</p>
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setLocationSearch("");
                  setSelectedCategory(null);
                  setSelectedAudience(null);
                  setSelectedFilter(null);
                  setLocationMessage(null);
                }}
                className="mt-6 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          )}
        </section>
      </div>

      <BottomNav currentPath={window.location.pathname} navigateTo={navigateTo} />
    </div>
  );
};

export default CustomerHome;

