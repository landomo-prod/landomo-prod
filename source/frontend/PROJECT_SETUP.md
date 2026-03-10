# Next.js Project Setup - Gemini Boilerplate

## Overview
This Next.js project has been set up based on the Vercel Next.js boilerplate with additional configurations for a real estate property listing application.

## Tech Stack
- **Next.js 16.1.6** - React framework with App Router
- **React 19.2.3** - Latest React version
- **TypeScript 5** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **Leaflet 1.9.4** - Interactive maps library
- **React Leaflet 5.0.0** - React components for Leaflet
- **Lucide React 0.563.0** - Icon library

## Project Structure

```
gemini-boilerplate/
├── app/                    # Next.js App Router directory
│   ├── favicon.ico        # App favicon
│   ├── globals.css        # Global styles with Tailwind & Shadcn
│   ├── layout.tsx         # Root layout component
│   └── page.tsx           # Home page
├── components/            # Reusable React components
├── lib/                   # Utility functions and helpers
├── types/                 # TypeScript type definitions
├── public/                # Static assets
├── .next/                 # Next.js build output (gitignored)
├── node_modules/          # Dependencies (gitignored)
├── package.json           # Project dependencies
├── tsconfig.json          # TypeScript configuration
├── next.config.ts         # Next.js configuration
├── postcss.config.mjs     # PostCSS configuration
└── eslint.config.mjs      # ESLint configuration
```

## Key Features

### TypeScript Support
- Fully typed with TypeScript 5
- Path aliases configured (`@/*` maps to project root)
- Strict mode enabled for better type safety

### Tailwind CSS v4
- Latest Tailwind CSS with new features
- Shadcn UI integration with custom theme
- CSS variables for theming (light/dark mode support)
- Custom color palette using OKLCH color space

### App Router
- Uses Next.js App Router (not Pages Router)
- React Server Components by default
- File-based routing in `app/` directory

### Dependencies Installed
- `leaflet` & `react-leaflet` - For map integration
- `lucide-react` - Icon library
- `@types/leaflet` - TypeScript types for Leaflet

## Available Scripts

```bash
npm run dev      # Start development server (with turbopack)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Next Steps

1. **Create components** - Build reusable UI components in `components/`
2. **Add routes** - Create new pages in `app/` directory
3. **Implement map** - Use Leaflet/React Leaflet for interactive maps
4. **Add Shadcn components** - Install additional UI components as needed
5. **Configure data** - Add property data and types in `types/`

## Configuration Notes

### Import Aliases
The `@/*` alias is configured to point to the project root, allowing imports like:
```typescript
import { Button } from '@/components/ui/button'
```

### React Compiler
The project has React Compiler enabled in `next.config.ts` for performance optimizations.

### Tailwind & Shadcn
- Global styles are in `app/globals.css`
- Shadcn UI components use CSS variables for theming
- Dark mode support is built-in

## Development

To start developing:

1. Run the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

3. Edit files in `app/` or `components/` - changes will hot-reload automatically

## Git Repository
A git repository has been initialized. Make sure to commit your changes regularly.
