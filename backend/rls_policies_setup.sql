-- ==========================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR INNAIKKU PLATFORM
-- Execute this script in the Supabase SQL Editor to secure your database.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Enable RLS on all tables
-- ----------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- 2. Profiles Table Policies
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
CREATE POLICY "Allow public read access to profiles"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND (
        -- Protect role & is_approved: users cannot change their own role or approval status unless they are admin
        (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
        AND (is_approved = (SELECT is_approved FROM public.profiles WHERE id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    )
);

DROP POLICY IF EXISTS "Allow handle_new_user trigger to insert" ON public.profiles;
CREATE POLICY "Allow handle_new_user trigger to insert"
ON public.profiles FOR INSERT
WITH CHECK (true); -- Plpgsql handle_new_user trigger runs as SECURITY DEFINER anyway

-- ----------------------------------------------------------
-- 3. Shops Table Policies
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access to approved shops" ON public.shops;
CREATE POLICY "Allow public read access to approved shops"
ON public.shops FOR SELECT
USING (is_approved = true OR auth.uid() = owner_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Allow owners to insert shop details" ON public.shops;
CREATE POLICY "Allow owners to insert shop details"
ON public.shops FOR INSERT
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow owners to update their approved shop details" ON public.shops;
CREATE POLICY "Allow owners to update their approved shop details"
ON public.shops FOR UPDATE
USING (
    auth.uid() = owner_id 
    AND (
        (SELECT is_approved FROM public.shops WHERE owner_id = auth.uid()) = true 
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
)
WITH CHECK (
    auth.uid() = owner_id
    AND (
        -- Protect is_approved column from self-modification
        (is_approved = (SELECT is_approved FROM public.shops WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    )
);

-- ----------------------------------------------------------
-- 4. Items Table Policies
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access to items" ON public.items;
CREATE POLICY "Allow public read access to items"
ON public.items FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow approved shop owners to write items" ON public.items;
CREATE POLICY "Allow approved shop owners to write items"
ON public.items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shops
        WHERE id = shop_id 
        AND owner_id = auth.uid()
        AND is_approved = true
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Allow approved shop owners to update items" ON public.items;
CREATE POLICY "Allow approved shop owners to update items"
ON public.items FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.shops
        WHERE id = shop_id 
        AND owner_id = auth.uid()
        AND is_approved = true
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Allow approved shop owners to delete items" ON public.items;
CREATE POLICY "Allow approved shop owners to delete items"
ON public.items FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.shops
        WHERE id = shop_id 
        AND owner_id = auth.uid()
        AND is_approved = true
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ----------------------------------------------------------
-- 5. Offers Table Policies
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access to offers" ON public.offers;
CREATE POLICY "Allow public read access to offers"
ON public.offers FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow approved shop owners to manage offers" ON public.offers;
CREATE POLICY "Allow approved shop owners to manage offers"
ON public.offers FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.items i
        JOIN public.shops s ON i.shop_id = s.id
        WHERE i.id = item_id 
        AND s.owner_id = auth.uid()
        AND s.is_approved = true
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ----------------------------------------------------------
-- 6. Wishlists Table Policies
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Allow customers to manage their own wishlists" ON public.wishlists;
CREATE POLICY "Allow customers to manage their own wishlists"
ON public.wishlists FOR ALL
USING (auth.uid() = customer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
WITH CHECK (auth.uid() = customer_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Allow vendors to view wishlists of their items" ON public.wishlists;
CREATE POLICY "Allow vendors to view wishlists of their items"
ON public.wishlists FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.items i
        JOIN public.shops s ON i.shop_id = s.id
        WHERE i.id = item_id 
        AND s.owner_id = auth.uid()
    )
);
