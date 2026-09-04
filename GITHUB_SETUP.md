# GitHub Setup

1. git init && git add . && git commit -m init
2. Create repo on GitHub, push main
3. Settings > Secrets: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, VERCEL_TOKEN
4. CI runs on push/PR (.github/workflows/ci.yml)
5. Connect Vercel to repo for preview deploys
