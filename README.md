# DeviceManager

Admin dashboard for managing registered devices, activity logs, reports, and OTA firmware uploads. The app uses Next.js API routes with Google Sheets as the main data source.

## Features

- Admin login and session handling.
- Device registry management.
- Device activity logs and reports.
- Device license, toggle, expire, and delete API routes.
- OTA firmware upload, activation, and deletion flows.
- Google Sheets integration for device and activity data.
- Report pages by chat/user ID.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Google APIs

## Project Structure

```text
app/admin/            Admin dashboard pages and widgets
app/api/              Device, firmware, login, logout, and OTA API routes
app/report/           Public/report views
lib/auth.ts           Admin authentication helpers
lib/google-sheets.ts  Google Sheets integration
lib/ota-github.ts     OTA/GitHub helper logic
```

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_DEVICE_SHEET=MAC_REGISTRY
GOOGLE_SHEETS_ACTIVITY_SHEET=Sheet1
GOOGLE_SHEETS_TZ_OFFSET_MINUTES=420
```

`GOOGLE_SHEETS_PRIVATE_KEY` should be stored as one line with `\n` characters.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Deployment

Deploy with the Next.js preset on Vercel. Add all required environment variables in the Vercel project settings before building.
