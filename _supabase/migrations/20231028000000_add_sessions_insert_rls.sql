CREATE POLICY "Allow user to insert their own session"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()); 