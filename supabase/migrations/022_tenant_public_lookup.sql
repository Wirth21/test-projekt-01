-- Allow anyone (including unauthenticated) to look up tenant by slug.
-- Needed for middleware to resolve subdomains before auth.
CREATE POLICY "Anyone can look up tenant by slug"
  ON public.tenants
  FOR SELECT
  TO anon, authenticated
  USING (true);
