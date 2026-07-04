import { supabase } from "./src/lib/supabase";

async function test() {
  const { data, error } = await supabase.from("customer_bookings").select("*, customer_reviews(id)").limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}
test();
