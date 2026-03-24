# Only Us — Premium Couples Messaging App

A private, end-to-end encrypted messaging sanctuary built for two. Crafted with Expo SDK 54 and designed to work seamlessly in Expo Go.

## Getting Started

### Prerequisites
- Node.js 18+
- Expo Go app on your physical device
- The backend server running (Python FastAPI in the parent directory)

### Install & Run

```bash
cd app-client
npm install
npx expo start
```

Scan the QR code with Expo Go to launch on your device.

### Backend Setup

```bash
# From the parent onlyus/ directory
pip install -r requirements.txt
python main.py
```

The API runs at `http://localhost:8000`. Update `API_URL` in `constants/theme.ts` if using a different host/IP.

## Features

| Feature | Implementation |
|---------|---------------|
| **Authentication** | JWT with expo-secure-store |
| **Pairing** | 6-digit code with countdown |
| **Real-time Chat** | Socket.IO (websocket transport) |
| **Encryption** | expo-crypto (SHA-256 + XOR cipher) |
| **Offline Storage** | expo-sqlite for messages |
| **Media Sharing** | expo-image-picker + chunked transfer |
| **Mood Sharing** | Real-time mood icons via Socket.IO |
| **Presence** | Online/offline status |
| **Typing** | Real-time typing indicators |
| **Reactions** | Icon-only reactions (no emojis) |
| **Glass UI** | Semi-transparent cards with blur |
| **Haptics** | Tactile feedback on all interactions |
| **Animations** | Spring animations via reanimated |
| **Dark/Light** | Automatic theme switching |
| **Milestones** | Anniversary tracking with days counter |

## Architecture

```
app-client/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login & Register
│   ├── (onboarding)/       # Welcome & Pairing
│   ├── (tabs)/             # Chat, Moments, Calendar, Settings
│   └── _layout.tsx         # Root layout with auth gate
├── components/ui/          # Glass UI components
├── constants/theme.ts      # Design system
├── hooks/useSocket.ts      # Socket.IO hook
├── services/
│   ├── api.ts              # REST API client
│   ├── database.ts         # SQLite operations
│   └── encryption.ts       # E2E encryption
└── stores/
    ├── authStore.ts         # Auth & pairing state
    └── chatStore.ts         # Messages & chat state
```

## Expo Go Compatibility

All features use Expo SDK APIs only — no native modules or custom native code required. Tested on physical devices via Expo Go.

## Design

Warm color palette with glass morphism throughout. Uses Ionicons exclusively (no emojis). SF Pro system font with Dynamic Type support.
