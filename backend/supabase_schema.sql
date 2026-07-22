-- Clean up existing views and tables if they exist to allow a fresh setup
DROP VIEW IF EXISTS public.item_wishlist_counts CASCADE;
DROP VIEW IF EXISTS public.shop_inventory_by_category CASCADE;
DROP VIEW IF EXISTS public.active_offers_by_shop CASCADE;
DROP TABLE IF EXISTS public.wishlists CASCADE;
DROP TABLE IF EXISTS public.offers CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.shops CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. Profiles Table (Supports admin approval logic for vendors)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer', 'vendor', 'admin')),
    full_name TEXT,
    location TEXT,
    shop_name TEXT,
    document_url TEXT,
    preferred_language TEXT DEFAULT 'ta',
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger function to automatically create public profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, phone, role, full_name, location, shop_name, document_url, preferred_language, is_approved)
    VALUES (
        new.id,
        new.phone,
        coalesce(new.raw_user_meta_data->>'role', 'customer'),
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
        coalesce(new.raw_user_meta_data->>'location', 'Hosur'),
        new.raw_user_meta_data->>'shop_name',
        new.raw_user_meta_data->>'document_url',
        coalesce(new.raw_user_meta_data->>'preferred_language', 'ta'),
        -- Customers are approved automatically; Vendors require manual admin approval
        (coalesce(new.raw_user_meta_data->>'role', 'customer') = 'customer')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Shops Table (For Vendors)
CREATE TABLE public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    location TEXT NOT NULL,
    phone TEXT,
    document_url TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Storage bucket for Vendor Proof Documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vendor-documents', 'vendor-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Items Table (Products catalog of shops)
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Offers Table (Active deals on items)
CREATE TABLE public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE UNIQUE NOT NULL,
    discount_pct NUMERIC(5, 2) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
    sale_price NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Wishlists Table (Customer wishlist requests, linking to a valid item)
CREATE TABLE public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    budget NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (customer_id, item_id)
);

-- 6. View: active_offers_by_shop
CREATE OR REPLACE VIEW public.active_offers_by_shop AS
SELECT 
    o.id AS offer_id,
    o.discount_pct,
    o.sale_price,
    o.description,
    i.id AS item_id,
    i.name AS item_name,
    i.category,
    s.id AS shop_id,
    s.name AS shop_name,
    s.location AS location
FROM public.offers o
JOIN public.items i ON o.item_id = i.id
JOIN public.shops s ON i.shop_id = s.id;

-- 7. View: shop_inventory_by_category
CREATE OR REPLACE VIEW public.shop_inventory_by_category AS
SELECT 
    s.id AS shop_id,
    s.name AS shop_name,
    i.category,
    i.id AS item_id,
    i.name AS item_name,
    i.price
FROM public.items i
JOIN public.shops s ON i.shop_id = s.id;

-- 8. View: item_wishlist_counts (To see how many customers wishlisted a particular item)
CREATE OR REPLACE VIEW public.item_wishlist_counts AS
SELECT 
    i.id AS item_id,
    i.name AS item_name,
    s.name AS shop_name,
    s.id AS shop_id,
    COUNT(w.id) AS wishlist_count
FROM public.items i
JOIN public.shops s ON i.shop_id = s.id
LEFT JOIN public.wishlists w ON i.id = w.item_id
GROUP BY i.id, i.name, s.name, s.id;

-- 9. Insert Dummy/Sample Seed Data for Out-of-the-Box Testing

-- A. Create default VENDOR User (Phone: +919999999999, Password: Password123!)
INSERT INTO auth.users (id, phone, encrypted_password, raw_user_meta_data, email, phone_confirmed_at, role)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '+919999999999',
    extensions.crypt('Password123!', extensions.gen_salt('bf', 10)),
    '{"role": "vendor"}'::jsonb,
    'vendor_demo@innaikku.in',
    now(),
    'authenticated'
) ON CONFLICT (id) DO UPDATE SET encrypted_password = extensions.crypt('Password123!', extensions.gen_salt('bf', 10));

-- Sync public profiles for Vendor
INSERT INTO public.profiles (id, phone, role, is_approved)
VALUES ('00000000-0000-0000-0000-000000000000', '+919999999999', 'vendor', TRUE)
ON CONFLICT (id) DO UPDATE SET role = 'vendor', is_approved = TRUE;


-- B. Create default ADMIN User (Phone: 0000000000, Password: Password123!)
INSERT INTO auth.users (id, phone, encrypted_password, raw_user_meta_data, email, phone_confirmed_at, role)
VALUES (
    '5611ff6a-ab21-4752-bf5f-4018bd211c43',
    '0000000000',
    extensions.crypt('Password123!', extensions.gen_salt('bf', 10)),
    '{"role": "admin"}'::jsonb,
    'admin_demo@innaikku.in',
    now(),
    'authenticated'
) ON CONFLICT (id) DO UPDATE SET encrypted_password = extensions.crypt('Password123!', extensions.gen_salt('bf', 10));

-- Sync public profiles for Admin
INSERT INTO public.profiles (id, phone, role, is_approved)
VALUES ('5611ff6a-ab21-4752-bf5f-4018bd211c43', '0000000000', 'admin', TRUE)
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_approved = TRUE;


-- C. Create default CUSTOMER User (Phone: +919876543211, Password: Password123!)
INSERT INTO auth.users (id, phone, encrypted_password, raw_user_meta_data, email, phone_confirmed_at, role)
VALUES (
    '22222222-2222-2222-2222-222222222223',
    '+919876543211',
    extensions.crypt('Password123!', extensions.gen_salt('bf', 10)),
    '{"role": "customer"}'::jsonb,
    'customer_demo@innaikku.in',
    now(),
    'authenticated'
) ON CONFLICT (id) DO UPDATE SET encrypted_password = extensions.crypt('Password123!', extensions.gen_salt('bf', 10));

-- Sync public profiles for Customer
INSERT INTO public.profiles (id, phone, role, is_approved)
VALUES ('22222222-2222-2222-2222-222222222223', '+919876543211', 'customer', TRUE)
ON CONFLICT (id) DO UPDATE SET role = 'customer', is_approved = TRUE;


-- C. Create default Vendor Shop
INSERT INTO public.shops (id, owner_id, name, owner_name, location)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'Hosur Electronics Hub',
    'S. Murugan',
    'Denkanikottai Road, Hosur'
) ON CONFLICT (id) DO NOTHING;

-- D. Create standard catalog products
INSERT INTO public.items (id, shop_id, name, category, price)
VALUES 
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'iPhone 15', 'Electronics', 79999.00),
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Organic Apples', 'Groceries', 180.00),
    ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Mixie Grinder', 'Home Appliances', 3499.00),
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Smart Watch', 'Electronics', 2999.00)
ON CONFLICT (id) DO NOTHING;
