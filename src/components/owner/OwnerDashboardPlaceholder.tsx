import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { 
  LayoutDashboard, 
  Globe, 
  AlertCircle, 
  ArrowLeft, 
  Image as ImageIcon, 
  CheckCircle, 
  ExternalLink, 
  Sparkles, 
  Settings,
  ShieldAlert,
  ChevronRight,
  BookOpen
} from "lucide-react";

interface Props {
  navigateTo: (path: string) => void;
}

export default function OwnerDashboardPlaceholder({ navigateTo }: Props) {
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [servicesCount, setServicesCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "website">("overview");

  useEffect(() => {
    async function fetchOwnerShop() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: shopData } = await supabase
          .from("shops")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (shopData) {
          setShop(shopData);
          
          // Fetch services count
          const { count } = await supabase
            .from("shop_services")
            .select("*", { count: "exact", head: true })
            .eq("shop_id", shopData.id)
            .eq("is_active", true);

          setServicesCount(count || 0);
        }
      } catch (err) {
        console.error("Error fetching owner shop:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOwnerShop();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-4"></div>
        <p className="text-sm text-slate-500 font-medium">Loading Owner Dashboard...</p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
            <Globe className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900">No Registered Salon Found</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Please register your salon details first to generate and customize your free booking website.
            </p>
          </div>
          <button 
            onClick={() => navigateTo("/owner-register")}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl text-sm shadow-lg transition cursor-pointer"
          >
            Register Your Business
          </button>
        </div>
      </div>
    );
  }

  const galleryCount = shop.gallery_urls && Array.isArray(shop.gallery_urls) ? shop.gallery_urls.length : 0;
  const isApproved = shop.approval_status === "approved" && shop.is_active === true;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigateTo("/")}
            className="p-2 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <span className="text-3xs font-black text-slate-400 uppercase tracking-widest block">Nexora SalonOS</span>
            <h1 className="text-base font-black text-slate-900">Owner Console</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo("/owner-create-website")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-500/10"
          >
            <Settings className="w-3.5 h-3.5" />
            Launch Website Builder
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 mt-8">
        
        {/* Salon Header card */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col md:flex-row gap-6 items-center justify-between shadow-xs">
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
            <div className="w-16 h-16 rounded-2xl border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-50 flex items-center justify-center">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt="Logo" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl">
                  {shop.shop_name[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h2 className="text-lg font-black text-slate-900 leading-none">{shop.shop_name}</h2>
                {isApproved ? (
                  <CheckCircle className="w-4 h-4 text-blue-500 fill-white flex-shrink-0" />
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full">
                    Under Review
                  </span>
                )}
              </div>
              <p className="text-3xs text-slate-400 font-medium">Slug Domain: /shop/{shop.slug}</p>
            </div>
          </div>

          <div className="text-center md:text-right">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Approval Status</span>
            <span className={`text-xs font-bold ${isApproved ? "text-emerald-600" : "text-amber-600"}`}>
              {shop.approval_status === "approved" ? "Approved & Live" : "Pending Approval"}
            </span>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="flex border-b border-slate-200 mt-8 gap-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition relative cursor-pointer ${
              activeTab === "overview" 
                ? "text-blue-600" 
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Overview
            {activeTab === "overview" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab("website")}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition relative cursor-pointer ${
              activeTab === "website" 
                ? "text-blue-600" 
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Website & Media ({galleryCount + (shop.logo_url ? 1 : 0) + (shop.banner_url || shop.cover_image_url ? 1 : 0)})
            {activeTab === "website" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
          </button>
        </div>

        {/* Tab Panel Content */}
        <div className="mt-6">
          {activeTab === "overview" ? (
            <div className="space-y-6">
              
              {/* Info Notification Banner */}
              {!isApproved && (
                <div className="p-4 rounded-3xl bg-amber-50/50 border border-amber-100/60 flex gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-amber-900">Your Salon is Pending Approval</span>
                    <p className="text-amber-800 font-light">
                      The admin team is currently validating your business documents. You can still customize your template designs, upload your logos, and prepare your service catalog right away!
                    </p>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Services Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-3xs font-black text-slate-400 uppercase tracking-wider block">Service Catalog</span>
                    <h3 className="text-2xl font-black text-slate-900">{servicesCount}</h3>
                    <p className="text-4xs text-slate-400">active services menu</p>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>

                {/* Templates Design Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-3xs font-black text-slate-400 uppercase tracking-wider block">Website Template</span>
                    <h3 className="text-sm font-black text-slate-900 mt-2 truncate max-w-[150px]">
                      {shop.selected_template === "royal_luxe" ? "Royal Luxe" : shop.selected_template === "professional_beauty" ? "Professional Beauty" : "Modern Salon"}
                    </h3>
                    <p className="text-4xs text-slate-400">custom design style</p>
                  </div>
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>

                {/* Live Link Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-2xs">
                  <div className="space-y-1 flex-1">
                    <span className="text-3xs font-black text-slate-400 uppercase tracking-wider block">Website URL Link</span>
                    <div className="pt-2">
                      {isApproved ? (
                        <a 
                          href={`/shop/${shop.slug}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                        >
                          Visit Live Shop
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-3xs font-bold text-slate-400 italic">No public link yet</span>
                      )}
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                </div>

              </div>

              {/* Quick Actions List */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Next Steps</h3>
                
                <div className="divide-y divide-slate-100">
                  <button 
                    onClick={() => navigateTo("/owner-create-website")}
                    className="w-full py-4 flex items-center justify-between text-left hover:bg-slate-50/50 px-2 rounded-xl transition cursor-pointer"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Customize Website & Design</h4>
                      <p className="text-3xs text-slate-400 mt-0.5">Edit slogans, templates, descriptions, and branding details.</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button 
                    onClick={() => navigateTo("/owner-create-website")}
                    className="w-full py-4 flex items-center justify-between text-left hover:bg-slate-50/50 px-2 rounded-xl transition cursor-pointer"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Manage Media Uploads</h4>
                      <p className="text-3xs text-slate-400 mt-0.5">Upload, replace, and delete logo images, hero banners, and portfolio gallery items.</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Media assets list */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-6 shadow-2xs">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Branding Assets Status</h3>
                  <p className="text-3xs text-slate-400 mt-0.5">Monitor files uploaded to your Supabase `shop-media` bucket.</p>
                </div>

                <div className="space-y-4">
                  {/* Logo status item */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                        {shop.logo_url ? (
                          <img src={shop.logo_url} alt="Logo" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Salon Logo</h4>
                        <p className="text-3xs text-slate-400 mt-0.5">Shows up as circular profile asset in header</p>
                      </div>
                    </div>
                    <div>
                      {shop.logo_url ? (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                          Uploaded
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full">
                          Missing
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Banner status item */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                        {shop.banner_url || shop.cover_image_url ? (
                          <img src={shop.banner_url || shop.cover_image_url} alt="Banner" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Hero Banner Background</h4>
                        <p className="text-3xs text-slate-400 mt-0.5">Displays as website top section artwork</p>
                      </div>
                    </div>
                    <div>
                      {shop.banner_url || shop.cover_image_url ? (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                          Uploaded
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full">
                          Missing
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Gallery status item */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-slate-200 bg-white flex items-center justify-center flex-shrink-0 font-mono text-xs font-black text-slate-500">
                        {galleryCount}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Portfolio Gallery</h4>
                        <p className="text-3xs text-slate-400 mt-0.5">Showcase grid layout of images on website</p>
                      </div>
                    </div>
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        galleryCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        {galleryCount} / 10 Images
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => navigateTo("/owner-create-website")}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-500/10"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Edit Website & Media Assets
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
