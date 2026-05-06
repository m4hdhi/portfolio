# Mahdhi Portfolio

This is my personal portfolio website, built to showcase my profile, tech stack, experience, projects, and contact details.

It is built with Next.js, React, TypeScript, Tailwind CSS, Spline, and a Socket.IO realtime backend.

## Features

- Interactive profile, skills, experience, projects, and contact sections
- Admin dashboard to update portfolio content
- Password-protected admin login and password change
- Realtime visitor/chat features powered by Socket.IO
- Contact email API integration with Resend
- Custom 3D 404 page

## Local Development

Install dependencies:

```bash
pnpm install
npm --prefix realtime-server install
```

Run the frontend:

```bash
npm run dev
```

Run the realtime backend:

```bash
npm run dev:realtime
```

The frontend runs on `http://localhost:3000` and the realtime backend runs on `http://localhost:4000`.

## Environment

Create `.env.local` from `.env.example` and fill in your private values. Do not commit `.env.local`.

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_WS_URL` is public and should point to the deployed realtime backend URL in production.
