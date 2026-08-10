-- 1. Add requirement flag to events
ALTER TABLE events
ADD COLUMN is_resume_required BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add resume reference to rsvps
ALTER TABLE rsvps
ADD COLUMN resume_path TEXT;

-- 3. Create event_sponsors table for Sponsor Portal access
CREATE TABLE IF NOT EXISTS public.event_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, email)
);

-- RLS for event_sponsors
ALTER TABLE public.event_sponsors ENABLE ROW LEVEL SECURITY;

-- Only admins/event organizers can manage sponsors
CREATE POLICY "Event organizers can manage sponsors" 
ON public.event_sponsors
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_sponsors.event_id 
    AND (e.creator_id = auth.uid() OR e.club_id IN (SELECT club_id FROM public.club_members WHERE user_id = auth.uid() AND role IN ('admin', 'organizer')))
  )
);

-- Sponsors can view their own sponsorship records if authenticated via token
CREATE POLICY "Sponsors can view their own records" 
ON public.event_sponsors
FOR SELECT 
USING (
  access_token = current_setting('request.jwt.claims', true)::json->>'sponsor_token'
);

-- 4. Supabase Storage for resumes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for resumes

-- Policy: Users can upload their own resume for an event
-- Path format: resumes/{event_id}/{user_id}/*
CREATE POLICY "Users can upload their own resumes"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can read their own resumes
CREATE POLICY "Users can read their own resumes"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'resumes' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Verified sponsors can read resumes for their events
CREATE POLICY "Sponsors can read resumes for their events"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'resumes' AND
  EXISTS (
    SELECT 1 FROM public.event_sponsors s
    WHERE s.event_id::text = (storage.foldername(name))[1]
    AND s.access_token = current_setting('request.jwt.claims', true)::json->>'sponsor_token'
    AND s.expires_at > now()
  )
);
