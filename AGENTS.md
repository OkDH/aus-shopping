# AGENTS.md

## Project Overview

호주 마켓(Woolworths, Coles, Aldi, IGA)产品价格比较应用。用户可以记录购物价格，系统自动计算每100ml/g的单价进行对比。

**Tech Stack:**
- Next.js 16 (App Router)
- Prisma 7 + PostgreSQL (Supabase)
- Tailwind CSS

## Build Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Database Setup

1. Create a Supabase project at https://supabase.com
2. Get your PostgreSQL connection string from Supabase dashboard
3. Update `.env` with your Supabase credentials:

```
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
```

4. Push schema to database:
```bash
npx prisma db push
```

5. Generate Prisma client:
```bash
npx prisma generate
```

## Data Models

### ProductType (제품)
- `id`: UUID
- `name`: 제품 유형 (우유, 과일, 채소 등)

### Product (제품명)
- `id`: UUID
- `productTypeId`: FK → ProductType
- `name`: 실제 제품명 (서울 우유, 김포 사과 등)
- `defaultUnit`: 단위 (ml, g, 개)

### Price
- `id`: UUID
- `productId`: FK → Product
- `market`: 마켓명
- `price`: 가격
- `volume`: 용량

## Code Style Guidelines

### TypeScript

- Use strict TypeScript; avoid `any`
- Define explicit return types for functions
- Use interfaces for object shapes; use types for unions/primitives
- Prefer `type` over `enum`

### Naming Conventions

- **Files**: kebab-case for utilities (`date-utils.ts`), PascalCase for components (`Button.tsx`)
- **Variables/functions**: camelCase
- **Classes/Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Boolean variables**: prefix with `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasError`)

### React/Components

- Functional components with hooks only (no class components)
- Prop types via TypeScript interfaces

## Architecture

```
src/
├── app/           # Next.js App Router pages
│   ├── page.tsx   # Main page with all features
│   └── layout.tsx # Root layout
├── lib/
│   └── db.ts      # Prisma client
├── components/    # (future) reusable components
└── generated/
    └── prisma/    # Generated Prisma client
```

## Features

1. **제품/가격 추가**: 제품명과 마켓별 가격 입력
2. **제품 리스트**: 저장된 제품 목록 조회
3. **가격 비교**: 100ml(g)당 가격 자동 계산 후 정렬

## Deployment

Deploy to Vercel with `vercel deploy`. The hobby plan is free.
