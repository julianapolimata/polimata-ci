import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://iqtkpyrpwxypwcwrhulx.supabase.co'
const SUPABASE_KEY = 'sb_publishable_vRcs1UCbW6QQd7W-H9B_Ug_N13YAff_'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
