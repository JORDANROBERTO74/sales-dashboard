/**
 * TypeScript types for the ecommerce system
 */

// ==================== BRANCHES ====================
export type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  opening_hours: Record<string, string> | null; // { monday: "09:00-18:00", ... }
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
};

// ==================== CATEGORÍAS ====================
export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  parent?: Category | null;
  children?: Category[];
  products_count?: number;
};

// ==================== PRODUCTOS ====================
export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null; // Previous price (to show discounts)
  cost_price: number | null; // Cost price
  category_id: string | null;
  brand: string | null;
  weight: number | null;
  dimensions: {
    length?: number;
    width?: number;
    height?: number;
  } | null;
  images: string[]; // Image URLs
  is_active: boolean;
  is_featured: boolean;
  is_digital: boolean; // If it's a digital product (not physical)
  track_inventory: boolean; // If inventory should be tracked
  low_stock_threshold: number | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Relations
  category?: Category | null;
  variants?: ProductVariant[];
  stock?: Stock[];
};

// ==================== PRODUCT VARIANTS ====================
export type ProductVariant = {
  id: string;
  product_id: string;
  sku: string;
  name: string; // e.g.: "Red - Size M"
  price: number | null; // If null, uses product price
  compare_at_price: number | null;
  attributes: Record<string, string>; // { color: "red", size: "M" }
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Relations
  product?: Product;
  stock?: Stock[];
};

// ==================== STOCK BY BRANCH ====================
export type Stock = {
  id: string;
  product_id: string | null; // If null, it's variant stock
  variant_id: string | null; // If null, it's base product stock
  branch_id: string;
  quantity: number;
  reserved_quantity: number; // Reserved quantity (in carts, pending orders)
  available_quantity: number; // quantity - reserved_quantity
  min_stock_level: number | null;
  max_stock_level: number | null;
  last_restocked_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  product?: Product | null;
  variant?: ProductVariant | null;
  branch?: Branch;
};

// ==================== SHOPPING CART ====================
export type CartItem = {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  price: number; // Price at time of adding (snapshot)
  created_at: string;
  updated_at: string;
  // Relations
  product?: Product;
  variant?: ProductVariant | null;
};

export type Cart = {
  id: string;
  user_id: string | null; // null for guest carts
  session_id: string | null; // For guest carts
  branch_id: string | null; // Selected branch for delivery/pickup
  items_count: number;
  total_amount: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  items?: CartItem[];
  branch?: Branch | null;
};

// ==================== ÓRDENES ====================
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "ready"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string; // Name snapshot at time of order
  variant_name: string | null;
  sku: string;
  quantity: number;
  price: number; // Price at time of order
  subtotal: number; // price * quantity
  created_at: string;
  // Relations
  product?: Product;
  variant?: ProductVariant | null;
};

export type ShippingMethod = "pickup" | "delivery" | "express";

export type Order = {
  id: string;
  order_number: string; // Unique order number (e.g.: ORD-2024-0001)
  user_id: string | null; // null for guest orders
  email: string; // Email del cliente (puede no estar registrado)
  phone: string | null;
  status: OrderStatus;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_method: string | null;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string; // "BOB" by default
  shipping_method: ShippingMethod;
  branch_id: string | null; // If pickup
  shipping_address: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string | null;
    phone: string | null;
  } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  items?: OrderItem[];
  branch?: Branch | null;
  user?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
};

// ==================== PAYMENTS ====================
export type Payment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider: string | null; // "stripe", "paypal", etc.
  transaction_id: string | null;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Relations
  order?: Order;
};

// ==================== CLIENTES (para ecommerce) ====================
export type Customer = {
  id: string;
  user_id: string | null; // If registered, reference to users
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  document_id: string | null; // CI, NIT, etc.
  addresses: CustomerAddress[];
  default_address_id: string | null;
  total_orders: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  // Relations
  user?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  orders?: Order[];
};

export type CustomerAddress = {
  id: string;
  customer_id: string;
  name: string; // Recipient name
  address: string;
  city: string;
  state: string;
  zip_code: string | null;
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

// ==================== COUPONS/DISCOUNTS ====================
export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  minimum_purchase: number | null;
  maximum_discount: number | null; // Only for percentage
  usage_limit: number | null; // Número total de veces que se puede usar
  usage_count: number; // Veces que ya se ha usado
  user_usage_limit: number | null; // Límite por usuario
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ==================== FILTERS AND SEARCH ====================
export type ProductFilters = {
  searchQuery?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  tags?: string[];
  inStock?: boolean;
  isFeatured?: boolean;
  sortBy?:
    | "price_asc"
    | "price_desc"
    | "name_asc"
    | "name_desc"
    | "newest"
    | "popular";
  page?: number;
  pageSize?: number;
};

export type ProductsResponse = {
  products: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ==================== LOCAL CART (CLIENT SIDE) ====================
export type LocalCartItem = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
};

// ==================== WISHLIST ====================
export type WishlistItem = {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  created_at: string;
  // Relations
  product?: Product;
  variant?: ProductVariant | null;
};

// ==================== REVIEWS ====================
export type ProductReview = {
  id: string;
  product_id: string;
  user_id: string | null;
  order_id: string | null; // If linked to an order
  rating: number; // 1-5
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  is_published: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  // Relations
  user?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
};
