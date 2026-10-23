/** Categories every new user starts with. Keywords power Quick add and receipt matching. */
export const DEFAULT_CATEGORIES: {
  name: string; emoji: string; color: string; type: "expense" | "income"; subcategories?: string[]; keywords?: string[];
}[] = [
  { name: "Food", emoji: "🍔", color: "#FFF1E8", type: "expense", subcategories: ["Eating out", "Delivery", "Snacks"], keywords: ["lunch", "dinner", "breakfast", "food", "restaurant", "pizza", "burger", "biryani", "karahi", "foodpanda", "kfc", "mcdonalds", "savour", "shawarma", "snack"] },
  { name: "Groceries", emoji: "🛒", color: "#E6F6EE", type: "expense", keywords: ["grocery", "groceries", "imtiaz", "carrefour", "metro", "naheed", "vegetables", "fruit", "milk", "doodh", "sabzi", "kiryana"] },
  { name: "Transport", emoji: "🚗", color: "#E9F0FF", type: "expense", subcategories: ["Fuel", "Ride-hailing", "Parking"], keywords: ["careem", "uber", "indrive", "bykea", "taxi", "rickshaw", "petrol", "fuel", "parking", "toll", "metro bus"] },
  { name: "Bills", emoji: "💡", color: "#FFF6DB", type: "expense", subcategories: ["Electricity", "Gas", "Water", "Internet"], keywords: ["bill", "iesco", "lesco", "kelectric", "sui gas", "sngpl", "internet", "stormfiber", "ptcl", "nayatel", "water"] },
  { name: "Shopping", emoji: "🛍️", color: "#F1ECFF", type: "expense", subcategories: ["Clothes", "Electronics", "Home"], keywords: ["daraz", "shopping", "clothes", "shoes", "amazon", "outfitters", "khaadi"] },
  { name: "Mobile", emoji: "📱", color: "#E8F7FA", type: "expense", keywords: ["mobile", "jazz", "zong", "telenor", "ufone", "recharge", "load", "package"] },
  { name: "Fun", emoji: "🎬", color: "#FFE9EF", type: "expense", subcategories: ["Movies", "Games", "Subscriptions"], keywords: ["cinema", "cinepax", "movie", "netflix", "spotify", "game", "playstation", "youtube"] },
  { name: "Health", emoji: "💊", color: "#E8F7FA", type: "expense", keywords: ["doctor", "medicine", "pharmacy", "hospital", "clinic", "lab", "gym"] },
  { name: "Rent", emoji: "🏠", color: "#F1F2F4", type: "expense", keywords: ["rent", "kiraya"] },
  { name: "Coffee", emoji: "☕", color: "#FFF1E8", type: "expense", keywords: ["coffee", "chai", "tea", "starbucks", "gloria jeans", "cafe"] },
  { name: "Travel", emoji: "✈️", color: "#E9F0FF", type: "expense", keywords: ["flight", "hotel", "travel", "pia", "airblue", "booking", "ticket"] },
  { name: "Education", emoji: "📚", color: "#F1ECFF", type: "expense", keywords: ["course", "book", "school", "university", "fee", "tuition", "udemy"] },
  { name: "Gifts", emoji: "🎁", color: "#FFF6DB", type: "expense", keywords: ["gift", "eidi", "present", "wedding"] },
  { name: "Personal", emoji: "💇", color: "#FFE9EF", type: "expense", keywords: ["salon", "haircut", "barber", "cosmetics"] },
  { name: "Other", emoji: "✨", color: "#F1F2F4", type: "expense", keywords: [] },
  { name: "Salary", emoji: "💼", color: "#E6F6EE", type: "income", keywords: ["salary", "pay", "payroll"] },
  { name: "Freelance", emoji: "💻", color: "#E9F0FF", type: "income", keywords: ["freelance", "client", "upwork", "fiverr", "invoice"] },
  { name: "Gifts received", emoji: "🎁", color: "#FFF6DB", type: "income", keywords: ["eidi", "gift"] },
  { name: "Refunds", emoji: "↩️", color: "#F1F2F4", type: "income", keywords: ["refund", "cashback", "return"] },
  { name: "Other income", emoji: "✨", color: "#F1F2F4", type: "income", keywords: [] },
];

export const ACCOUNT_META: Record<string, { label: string; emoji: string }> = {
  cash: { label: "Cash", emoji: "💵" },
  bank: { label: "Bank", emoji: "🏦" },
  savings: { label: "Savings", emoji: "🐷" },
  credit: { label: "Credit card", emoji: "💳" },
  wallet: { label: "Wallet", emoji: "📱" },
  investment: { label: "Investment", emoji: "📈" },
  loan: { label: "Loan", emoji: "🤝" },
  other: { label: "Other", emoji: "✨" },
};

export const ACCOUNT_COLORS = ["#111318", "#2F5BEA", "#6B3FD6", "#13824F", "#FF5A36", "#C2335C", "#A66A00", "#0E7490"];
export const PERSON_COLORS = ["#E9F0FF", "#FFF6DB", "#EFE9FF", "#E6F6EE", "#FFE9EF", "#FFF1E8", "#E8F7FA"];
