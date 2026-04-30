# Meridian Portal — Claude Code Instructions

## Tech Stack

- Next.js 16 (App Router, React 19, React Compiler enabled)
- TypeScript 5
- Supabase (auth via @supabase/ssr, DB, storage, realtime)
- Redux Toolkit + react-redux
- Tailwind CSS 4
- shadcn/ui + Radix UI
- Lucide React (icons)
- Framer Motion (animations)
- react-hot-toast (notifications)
- Zod (validation)
- Resend (transactional emails)
- Stripe (payments)
- AI SDK (@ai-sdk/anthropic + @ai-sdk/google)
- @react-pdf/renderer (PDF generation)

## Rules

1. Read and strictly follow all patterns in .CODEBASE_PATTERNS.md before writing any code.
2. Reference FEATURES.md for business logic, workflows, and role permissions.
3. Reference schema.sql for all database table/column names — never guess.
4. Reference file-tree.txt to know what files exist before suggesting new ones.
5. Never recreate existing components, utils, or libs listed in the patterns doc.
6. Use Lucide icons — never emojis.
7. Inline destructured props — never separate interface Props.
8. Constants go in utils/constants/, interfaces in utils/interfaces/, helpers in utils/helpers/, validators in utils/validators/, hooks in utils/hooks/.
9. Keep files short: page.tsx ~50 lines, sections ~150 lines, modals ~150 lines, server actions ~200 lines.
10. Split pages into (sections)/ by visual area. Extract repeated UI into (components)/ or shared app/(components)/.
11. Always run `npm run build` after making changes to verify zero errors.
