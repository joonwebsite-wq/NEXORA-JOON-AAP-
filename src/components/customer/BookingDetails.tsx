import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  MessageCircle, 
  Navigation, 
  Clock, 
  Calendar, 
  User, 
  ShieldCheck, 
  Star, 
  ChevronRight, 
  AlertCircle,
  XCircle,
  RefreshCcw,
  CheckCircle2,
  MoreVertical,
  ExternalLink,
  Info,
  Sparkles,
  Share2,
  QrCode,
  Upload
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { 
  CustomerBooking, 
  BookingServiceDetail, 
  Shop, 
  ShopStaff, 
  Profile,
  CustomerReview 
} from "../../types";
import { getShopImage } from "../../lib/shopUtils";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import LoadingState from "./LoadingState";

interface BookingDetailsProps {
  navigateTo: (path: string) => void;
  bookingId: string;
}

const BookingDetails = ({ navigateTo, bookingId }: BookingDetailsProps) => {
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [staff, setStaff] = useState<ShopStaff | null>(null);
  const [services, setServices] = useState<BookingServiceDetail[]>([]);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // QR Payment & Settings States
  const [qrSettings, setQrSettings] = useState<any>(null);
  const [qrPayment, setQrPayment] = useState<any>(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [isBucketAvailable, setIsBucketAvailable] = useState(true);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Review state
  const [existingReview, setExistingReview] = useState<CustomerReview | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleShare = async () => {
    if (!booking || !shop) return;
    
    const serviceNames = services.map(s => s.service_name).join(", ");
    
    const shareText = `My Nexora SalonOS appointment:\n\nSalon: ${shop.shop_name}\nService: ${serviceNames || 'Salon Service'}\nDate: ${new Date(booking.booking_date).toLocaleDateString()}\nTime: ${booking.booking_time}\nStaff: ${staff?.staff_name || 'Any Available Expert'}\nLocation: ${shop.area}, ${shop.city}\nStatus: ${booking.status}\n\nBooked via Nexora SalonOS.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Nexora Salon Appointment",
          text: shareText,
          url: window.location.href
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("Error sharing:", err);
          setMessage({ type: 'error', text: "Unable to share appointment. Please try again." });
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText + "\n\n" + window.location.href);
        setMessage({ type: 'success', text: "Appointment details copied to clipboard." });
      } catch (err: any) {
         console.error("Error copying to clipboard:", err);
         setMessage({ type: 'error', text: "Unable to share appointment. Please try again." });
      }
    }
  };

  useEffect(() => {
    fetchBookingData();
  }, [bookingId]);

  const fetchBookingData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get Session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigateTo("/login");
        return;
      }

      // 2. Fetch Booking
      const { data: bookingData, error: bookingError } = await supabase
        .from("customer_bookings")
        .select("*")
        .eq("id", bookingId)
        .eq("customer_id", session.user.id)
        .single();

      if (bookingError) throw bookingError;
      if (!bookingData) throw new Error("Booking not found");
      setBooking(bookingData);
      setAmountPaid(bookingData.total_amount.toString());

      // 3. Fetch Related Data in Parallel
      const [shopRes, staffRes, servicesRes, profileRes, qrSettingsRes, qrPaymentRes] = await Promise.all([
        supabase.from("shops").select("*").eq("id", bookingData.shop_id).single(),
        bookingData.staff_id ? supabase.from("shop_staff").select("*").eq("id", bookingData.staff_id).single() : Promise.resolve({ data: null, error: null }),
        supabase.from("customer_booking_services").select("*").eq("booking_id", bookingId),
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("platform_qr_settings").select("*").eq("is_active", true).maybeSingle(),
        supabase.from("qr_payment_records").select("*").eq("booking_id", bookingId).maybeSingle()
      ]);

      if (shopRes.error) throw shopRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (profileRes.error) throw profileRes.error;

      setShop(shopRes.data);
      setStaff(staffRes.data);
      setServices(servicesRes.data || []);
      setCustomer(profileRes.data);
      setQrSettings(qrSettingsRes?.data || null);
      setQrPayment(qrPaymentRes?.data || null);

      if (qrPaymentRes?.data) {
        setAmountPaid(qrPaymentRes.data.gross_amount?.toString() || qrPaymentRes.data.amount?.toString() || bookingData.total_amount.toString());
        setPaymentReference(qrPaymentRes.data.payment_reference || qrPaymentRes.data.reference_id || qrPaymentRes.data.utr || "");
      }

      // 4. Check for existing review
      const { data: reviewData } = await supabase
        .from("customer_reviews")
        .select("*")
        .eq("booking_id", bookingId)
        .eq("customer_id", session.user.id)
        .maybeSingle();
      
      setExistingReview(reviewData);

      // 5. Test if storage bucket exists
      try {
        const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
        const exists = buckets?.some(b => b.name === "payment-proofs");
        setIsBucketAvailable(!!exists);
      } catch (err) {
        console.warn("Storage listBuckets error, assuming disabled:", err);
        setIsBucketAvailable(false);
      }

    } catch (err: any) {
      console.error("Error fetching booking details:", err);
      setError(err.message || "Unable to load booking details.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
    
    setCancelling(true);
    setMessage(null);
    try {
      const { error: updateError } = await supabase
        .from("customer_bookings")
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq("id", booking.id);

      if (updateError) throw updateError;

      setMessage({ type: 'success', text: "Booking cancelled successfully." });
      // Refresh local state
      setBooking({ ...booking, status: 'cancelled' });
    } catch (err: any) {
      console.error("Error cancelling booking:", err);
      setMessage({ type: 'error', text: err.message || "Failed to cancel booking." });
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking || !rating) return;
    
    setSubmittingReview(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error: reviewError } = await supabase
        .from("customer_reviews")
        .insert({
          customer_id: session.user.id,
          shop_id: booking.shop_id,
          booking_id: booking.id,
          rating: rating,
          review_text: reviewText
        })
        .select()
        .single();

      if (reviewError) throw reviewError;

      setExistingReview(data);
      setShowReviewForm(false);
      setMessage({ type: 'success', text: "Review submitted successfully." });
    } catch (err: any) {
      console.error("Error submitting review:", err);
      setMessage({ type: 'error', text: err.message || "Failed to submit review." });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !shop) return;
    if (!paymentReference.trim()) {
      setMessage({ type: 'error', text: "Payment reference / UTR is required." });
      return;
    }

    setSubmittingPayment(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigateTo("/login");
        return;
      }

      // Check duplicate
      const { data: existingPayment } = await supabase
        .from("qr_payment_records")
        .select("id")
        .eq("booking_id", booking.id)
        .maybeSingle();

      if (existingPayment) {
        setMessage({ type: 'error', text: "A payment record has already been submitted for this booking." });
        setSubmittingPayment(false);
        return;
      }

      let uploadedUrl = "";
      if (screenshotFile && isBucketAvailable) {
        setUploadingScreenshot(true);
        try {
          const fileExt = screenshotFile.name.split('.').pop();
          const fileName = `${booking.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("payment-proofs")
            .upload(filePath, screenshotFile);

          if (uploadError) {
            console.error("Screenshot upload failed:", uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from("payment-proofs")
              .getPublicUrl(filePath);
            uploadedUrl = publicUrl;
          }
        } catch (uploadErr) {
          console.error("Screenshot upload try-catch failed:", uploadErr);
        } finally {
          setUploadingScreenshot(false);
        }
      }

      const grossAmt = parseFloat(amountPaid) || booking.total_amount;

      // Insert record
      const { data: newPayment, error: insertError } = await supabase
        .from("qr_payment_records")
        .insert({
          shop_id: booking.shop_id,
          owner_id: shop.owner_id || null,
          customer_id: session.user.id,
          booking_id: booking.id,
          gross_amount: grossAmt,
          payment_reference: paymentReference,
          payment_screenshot_url: uploadedUrl || null,
          company_qr_used: true,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setQrPayment(newPayment);
      setMessage({ type: 'success', text: "Payment submitted for verification." });
    } catch (err: any) {
      console.error("Error submitting QR payment:", err);
      setMessage({ type: 'error', text: "Unable to submit payment. Please try again." });
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) return <LoadingState />;

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Booking not found</h2>
        <p className="text-slate-500 text-sm mb-6">{error || "This booking might have been removed or you don't have access."}</p>
        <button 
          onClick={() => navigateTo("/my-bookings")}
          className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs"
        >
          Back to My Bookings
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'confirmed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'completed': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'cancelled': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'no_show': return 'bg-slate-50 text-slate-600 border-slate-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'no_show': return 'No Show';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32 font-sans">
      <TopBar 
        title="Booking Details" 
        subtitle="View your appointment information"
        onBack={() => navigateTo("/my-bookings")} 
        showHome={true}
        onHome={() => navigateTo("/customer")}
        showMainSite={true}
        onMainSite={() => navigateTo("/")}
      />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-fade-in ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-bold">{message.text}</p>
          </div>
        )}

        {/* Status Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                </span>
                <p className="text-slate-400 text-[10px] font-medium pt-1">ID: {booking.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Booked On</p>
                <p className="text-xs font-bold text-slate-900">{new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
        </div>

        {/* Salon Card */}
        {shop && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-lg">{shop.shop_name}</h3>
                        {shop.is_verified && <ShieldCheck className="w-4 h-4 text-blue-500" />}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{shop.area}, {shop.city}</p>
                    <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-bold text-slate-900">{shop.rating}</span>
                    </div>
                </div>
                <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden shrink-0">
                    <img src={getShopImage(shop)} alt={shop.shop_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 leading-relaxed">{shop.address}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-2 pt-2">
                    <button className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition">
                        <Phone className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-bold text-slate-900">Call</span>
                    </button>
                    <button className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition">
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] font-bold text-slate-900">WhatsApp</span>
                    </button>
                    <button className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition">
                        <Navigation className="w-4 h-4 text-slate-600" />
                        <span className="text-[10px] font-bold text-slate-900">Directions</span>
                    </button>
                </div>
            </div>
          </div>
        )}

        {/* Appointment Details Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            <h4 className="font-bold text-slate-900 text-sm border-b border-slate-50 pb-4">Appointment Details</h4>
            
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Date</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{new Date(booking.booking_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Time</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{booking.booking_time}</p>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Expert</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{staff ? staff.staff_name : "Any Available Expert"}</p>
                    {staff && <p className="text-[10px] text-slate-400 font-medium">{staff.role_title}</p>}
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Duration</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{booking.total_duration_minutes} min</p>
                </div>
            </div>

            {booking.notes && (
                <div className="pt-4 border-t border-slate-50 space-y-2">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Info className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Notes</span>
                    </div>
                    <p className="text-xs text-slate-600 italic">"{booking.notes}"</p>
                </div>
            )}
        </div>

        {/* Services Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-900 text-sm pb-2">Selected Services</h4>
            <div className="space-y-3">
                {services.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2">
                        <div>
                            <p className="text-xs font-bold text-slate-900">{s.service_name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{s.duration_minutes} min</p>
                        </div>
                        <p className="text-xs font-black text-slate-900">₹{s.price}</p>
                    </div>
                ))}
            </div>
            
            <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                <p className="text-xs font-bold text-slate-500 uppercase">Total Amount</p>
                <p className="text-lg font-black text-slate-900">₹{booking.total_amount}</p>
            </div>
        </div>

        {/* Customer Info Card */}
        {customer && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-sm border-b border-slate-50 pb-4">Customer Information</h4>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name</p>
                      <p className="text-xs font-bold text-slate-900">{customer.full_name || "N/A"}</p>
                  </div>
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                      <p className="text-xs font-bold text-slate-900">{customer.phone || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                      <p className="text-xs font-bold text-slate-900">{customer.email || "N/A"}</p>
                  </div>
              </div>
          </div>
        )}

        {/* QR Payment Section */}
        {((booking.status === 'pending' || booking.status === 'confirmed') || qrPayment) && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            <h4 className="font-bold text-slate-900 text-sm border-b border-slate-50 pb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" /> Pay with Nexora SalonOS QR
            </h4>

            {qrPayment ? (
              // Existing Payment Record
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Payment Status</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      qrPayment.status === "verified" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                      qrPayment.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-100" :
                      "bg-amber-50 text-amber-700 border-amber-100"
                    }`}>
                      {qrPayment.status || "pending"}
                    </span>
                  </div>

                  {qrPayment.rejection_reason && (
                    <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-100">
                      <p className="font-bold">Rejection Reason:</p>
                      <p className="font-medium mt-0.5">{qrPayment.rejection_reason}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Amount Paid</span>
                      <span className="text-sm font-black text-slate-900">₹{qrPayment.gross_amount || qrPayment.amount || booking.total_amount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Reference / UTR</span>
                      <span className="text-sm font-mono font-bold text-slate-900">{qrPayment.payment_reference || qrPayment.reference_id || qrPayment.utr}</span>
                    </div>
                  </div>

                  {qrPayment.payment_screenshot_url && (
                    <div className="pt-2">
                      <a 
                        href={qrPayment.payment_screenshot_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-1 inline-flex"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Uploaded Screenshot
                      </a>
                    </div>
                  )}
                </div>

                {qrPayment.status === "rejected" && (booking.status === "pending" || booking.status === "confirmed") && (
                  <button
                    onClick={() => setQrPayment(null)}
                    className="w-full py-3 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Submit New Payment Info
                  </button>
                )}
              </div>
            ) : qrSettings ? (
              // Payment Submission Form
              <form onSubmit={handleSubmitPayment} className="space-y-5">
                <div className="flex flex-col items-center justify-center space-y-4">
                  {qrSettings.qr_image_url ? (
                    <div className="w-48 h-48 bg-slate-50 p-2 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden">
                      <img 
                        src={qrSettings.qr_image_url} 
                        alt="Nexora QR Code" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center p-4">
                      <QrCode className="w-12 h-12 text-slate-400 mb-2 animate-pulse" />
                      <span className="text-[10px] text-slate-400 font-bold">QR Image Missing</span>
                    </div>
                  )}

                  <div className="text-center space-y-1">
                    {qrSettings.payee_name && (
                      <p className="text-xs font-black text-slate-900">Payee: {qrSettings.payee_name}</p>
                    )}
                    {qrSettings.upi_id && (
                      <p className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg inline-block">
                        UPI ID: {qrSettings.upi_id}
                      </p>
                    )}
                  </div>

                  <p className="text-[10px] text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100/60 text-center w-full">
                    ⚠️ Use only Nexora SalonOS company QR for payment.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-3xs font-black uppercase tracking-wider text-slate-400">Amount Paid (₹)</label>
                    <input 
                      required
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-600 outline-none transition font-semibold"
                      placeholder="e.g. 500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-3xs font-black uppercase tracking-wider text-slate-400">Payment Reference / UTR</label>
                    <input 
                      required
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-600 outline-none transition font-semibold"
                      placeholder="e.g. 12-digit UPI Transaction ID"
                    />
                  </div>

                  {/* Screenshot Upload */}
                  <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <label className="block text-3xs font-black uppercase tracking-wider text-slate-400">Payment Screenshot (Optional)</label>
                    {isBucketAvailable ? (
                      <div className="mt-1">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setScreenshotFile(e.target.files[0]);
                            }
                          }}
                          className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-bold italic">Payment proof upload will be enabled soon.</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition shadow-lg shadow-slate-900/10 cursor-pointer disabled:opacity-50"
                  >
                    {submittingPayment ? "Submitting..." : "Submit Payment for Verification"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-slate-400 font-bold text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Nexora QR Code setup is pending by Admin.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {(booking.status === 'pending' || booking.status === 'confirmed') && (
            <div className="grid grid-cols-2 gap-4 pt-4">
                {new Date(`${booking.booking_date}T${booking.booking_time}`).getTime() > new Date().getTime() && (
                    <button 
                      onClick={handleShare}
                      className="col-span-2 flex items-center justify-center gap-2 py-4 px-6 bg-blue-50 text-blue-700 font-bold rounded-2xl text-xs border border-blue-100 hover:bg-blue-100 transition cursor-pointer"
                    >
                        <Share2 className="w-4 h-4" /> Share Appointment
                    </button>
                )}
                <button 
                  onClick={() => alert("Reschedule flow will be connected later.")}
                  className="flex items-center justify-center gap-2 py-4 px-6 bg-white text-slate-900 font-bold rounded-2xl text-xs border border-slate-200 shadow-sm hover:bg-slate-50 transition cursor-pointer"
                >
                    <RefreshCcw className="w-4 h-4" /> Reschedule
                </button>
                <button 
                  disabled={cancelling}
                  onClick={handleCancelBooking}
                  className={`flex items-center justify-center gap-2 py-4 px-6 bg-rose-50 text-rose-600 font-bold rounded-2xl text-xs border border-rose-100 hover:bg-rose-100 transition cursor-pointer ${cancelling ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                    <XCircle className="w-4 h-4" /> {cancelling ? "Cancelling..." : "Cancel Booking"}
                </button>
            </div>
        )}

        {(booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'no_show') && (
            <div className="space-y-4 pt-4">
                <button 
                  onClick={() => navigateTo(`/booking/${booking.shop_id}`)}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-blue-600 text-white font-bold rounded-2xl text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition"
                >
                    Book Again
                </button>
                {booking.status === 'completed' && (
                    <>
                      {existingReview ? (
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                          <p className="text-xs font-bold text-emerald-700">You have already reviewed this booking.</p>
                          <div className="flex justify-center gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className={`w-3 h-3 ${star <= existingReview.rating ? "text-amber-500 fill-amber-500" : "text-slate-300"}`} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowReviewForm(true)}
                          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-white text-slate-900 font-bold rounded-2xl text-sm border border-slate-200 shadow-sm hover:bg-slate-50 transition"
                        >
                            Leave a Review
                        </button>
                      )}
                    </>
                )}
            </div>
        )}

        {/* Review Form Overlay */}
        {showReviewForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-8 space-y-6 animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">How was your visit?</h3>
                <button onClick={() => setShowReviewForm(false)} className="p-2 hover:bg-slate-100 rounded-full transition">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-4 text-center py-4">
                <p className="text-sm text-slate-500 font-medium">Tap a star to rate your experience</p>
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star}
                      onClick={() => setRating(star)}
                      className="transition-transform active:scale-90"
                    >
                      <Star className={`w-10 h-10 ${star <= rating ? "text-amber-500 fill-amber-500" : "text-slate-200"}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Share more details (Optional)</label>
                <textarea 
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Tell us what you liked about the service..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[120px] resize-none"
                />
              </div>

              <button 
                disabled={!rating || submittingReview}
                onClick={handleSubmitReview}
                className={`w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-sm shadow-xl hover:bg-slate-800 transition ${(!rating || submittingReview) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        )}

        {/* Important Notes Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-4 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl -mr-10 -mt-10"></div>
            <div className="flex items-center gap-2 relative z-10">
                <Info className="w-4 h-4 text-blue-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider">Important Notes</h4>
            </div>
            <ul className="space-y-3 relative z-10">
                <li className="flex items-start gap-3 text-xs text-slate-300">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1.5"></span>
                    Please arrive 10 minutes before your scheduled time.
                </li>
                <li className="flex items-start gap-3 text-xs text-slate-300">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1.5"></span>
                    Booking confirmation updates will be added later.
                </li>
                <li className="flex items-start gap-3 text-xs text-slate-300">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1.5"></span>
                    QR rewards will apply after payment module is connected.
                </li>
                <li className="flex items-start gap-3 text-xs text-slate-300">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1.5"></span>
                    Contact salon directly for any urgent changes.
                </li>
            </ul>
        </div>
      </div>

      <BottomNav currentPath="/my-bookings" navigateTo={navigateTo} />
    </div>
  );
};

export default BookingDetails;
