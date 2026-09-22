import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tfwwapxewlxiclufpcct.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bQf1CYXUPQm-TC5hbo1RNA_FkwKzglK';
const EMAIL = 'hermes-playtest@keithslade.com';
const PASSWORD = 'PCpt-dg53EyaloNVY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });

if (error) {
  console.error('LOGIN ERROR:', error.message);
  process.exit(1);
}

console.log('LOGIN SUCCESS');
console.log(JSON.stringify(data.session));
