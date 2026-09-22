import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://gryzbwzfwvmfuwjlhruo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyeXpid3pmd3ZtZnV3amxocnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMzY1NzYsImV4cCI6MjEwNTYxMjU3Nn0.A4DJMqiMFAwQbzHUojbiSQFEMbngXlXEJocrmzgzvB8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
