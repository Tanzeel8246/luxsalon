const fs = require('fs');
let content = fs.readFileSync('services/businessService.ts', 'utf-8');
content = content.replace(/const supabase = getSupabaseClient\(\)/g, 'const supabase = getSupabaseClient() as any');
content = content.replace(/const supabase   = createAdminSupabaseClient\(\)/g, 'const supabase   = createAdminSupabaseClient() as any');
content = content.replace(/const supabase = createAdminSupabaseClient\(\)/g, 'const supabase = createAdminSupabaseClient() as any');
content = content.replace(/data \?\? \[\]\)\.map\(c =>/g, 'data ?? []).map((c: any) =>');
content = content.replace(/\}\)\)\.sort\(\(a, b\) => b\.match_score/g, '})).sort((a: any, b: any) => b.match_score');
content = content.replace(/reduce\(\(s, t\) => s \+ t\.amount/g, 'reduce((s: number, t: any) => s + t.amount');
fs.writeFileSync('services/businessService.ts', content);
