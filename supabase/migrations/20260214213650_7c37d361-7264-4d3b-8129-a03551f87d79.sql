
-- Create is_admin helper function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
$$;

-- Admin policies for profiles
CREATE POLICY "Admin view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin policies for tournaments
CREATE POLICY "Admin view all tournaments" ON public.tournaments FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin update all tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin delete all tournaments" ON public.tournaments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin policies for enrollments
CREATE POLICY "Admin view all enrollments" ON public.enrollments FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin update all enrollments" ON public.enrollments FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin delete all enrollments" ON public.enrollments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin policies for organizer_balances
CREATE POLICY "Admin view all balances" ON public.organizer_balances FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin update all balances" ON public.organizer_balances FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin policies for withdrawal_requests
CREATE POLICY "Admin view all withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin update all withdrawals" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin policies for user_roles
CREATE POLICY "Admin view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin policies for match_results
CREATE POLICY "Admin view all matches" ON public.match_results FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Admin policies for posts
CREATE POLICY "Admin view all posts" ON public.posts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
