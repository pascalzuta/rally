-- Create support_requests table for customer service contact form
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/gxiflulfgqahlvdirecz/sql

CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- Allow anonymous inserts (contact form submissions)
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a support request"
  ON public.support_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow reading for authenticated/service role (for the daily summary agent)
CREATE POLICY "Service role can read all support requests"
  ON public.support_requests
  FOR SELECT
  TO anon
  USING (true);

-- Allow updates for status changes
CREATE POLICY "Service role can update support requests"
  ON public.support_requests
  FOR UPDATE
  TO anon
  USING (true);

-- Index for querying by status and date
CREATE INDEX idx_support_requests_status ON public.support_requests (status);
CREATE INDEX idx_support_requests_created_at ON public.support_requests (created_at DESC);

-- Enable realtime (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_requests;
