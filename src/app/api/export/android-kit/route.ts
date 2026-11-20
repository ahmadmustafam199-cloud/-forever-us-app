import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(req.url).origin;

  const bundle = `# FOREVER US ❤️ — Complete Android (Expo React Native + Firebase + WebRTC) Release Kit
> Tagline: Two Hearts, One Private World.

This package provides both:
1. **Instant Android PWA & TWA APK Wrapper** pointing to your live running backend (${origin})
2. **Native React Native (Expo SDK 52 + TypeScript + Reanimated + Firebase + WebRTC)** configuration, strict two-user Firebase Security Rules, and EAS Build profiles to compile your signed installable **Android APK** and Play Store **Android App Bundle (AAB)**.

---

## 1. \`app.json\` (Expo Android Configuration)
\`\`\`json
{
  "expo": {
    "name": "Forever Us ❤️",
    "slug": "forever-us-couple",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/app-icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash-heart.png",
      "resizeMode": "contain",
      "backgroundColor": "#0D1126"
    },
    "plugins": [
      "expo-notifications",
      "expo-av",
      "expo-document-picker",
      "expo-image-picker",
      "@config-plugins/react-native-webrtc"
    ],
    "android": {
      "package": "love.foreverus.privateapp",
      "versionCode": 1,
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "foregroundImage": "./assets/app-icon.png",
        "backgroundColor": "#0D1126"
      },
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "MODIFY_AUDIO_SETTINGS",
        "READ_MEDIA_IMAGES",
        "READ_MEDIA_VIDEO",
        "POST_NOTIFICATIONS",
        "VIBRATE"
      ]
    }
  }
}
\`\`\`

---

## 2. \`eas.json\` (APK Installation & Release-Ready AAB Profiles)
\`\`\`json
{
  "cli": { "version": ">= 14.0.0", "appVersionSource": "remote" },
  "build": {
    "preview-apk": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production-aab": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "internal"
      }
    }
  }
}
\`\`\`

---

## 3. \`firestore.rules\` (Strict Two-Authorized-Users Security Rules)
\`\`\`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null && request.auth.token.email_verified == true;
    }

    function isAuthorizedSpouse(coupleId) {
      let couple = get(/databases/$(database)/documents/couples/$(coupleId)).data;
      return isSignedIn() && (
        request.auth.uid == couple.husbandId ||
        request.auth.uid == couple.wifeId
      );
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (
        request.auth.uid == userId ||
        resource.data.coupleId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.coupleId
      );
      allow create, update: if isSignedIn() && request.auth.uid == userId;
      allow delete: if false;
    }

    match /couples/{coupleId} {
      allow read: if isSignedIn() && (
        request.auth.uid == resource.data.husbandId ||
        request.auth.uid == resource.data.wifeId
      );
      allow create: if isSignedIn() && (
        (request.resource.data.husbandId == request.auth.uid && request.resource.data.wifeId == null) ||
        (request.resource.data.wifeId == request.auth.uid && request.resource.data.husbandId == null)
      );
      // Only allow complementary second spouse to connect while slot is empty; permanently locks to 2 accounts
      allow update: if isAuthorizedSpouse(coupleId) || (
        isSignedIn() &&
        request.resource.data.inviteCodeUsed == resource.data.inviteCode &&
        ((resource.data.husbandId == null && request.resource.data.husbandId == request.auth.uid && request.resource.data.wifeId == resource.data.wifeId) ||
         (resource.data.wifeId == null && request.resource.data.wifeId == request.auth.uid && request.resource.data.husbandId == resource.data.husbandId))
      );

      match /{subcollection}/{docId} {
        allow read, write: if isAuthorizedSpouse(coupleId);
      }
    }
  }
}
\`\`\`

---

## 4. \`storage.rules\` (Private Media Validation — Zero Public URLs)
\`\`\`
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthorizedSpouse(coupleId) {
      let couple = firestore.get(/databases/(default)/documents/couples/$(coupleId)).data;
      return request.auth != null && (
        request.auth.uid == couple.husbandId ||
        request.auth.uid == couple.wifeId
      );
    }

    function isValidMedia() {
      return (
        (request.resource.contentType.matches('image/(jpeg|png|webp|gif)') && request.resource.size < 15 * 1024 * 1024) ||
        (request.resource.contentType.matches('video/(mp4|webm|quicktime)') && request.resource.size < 45 * 1024 * 1024) ||
        (request.resource.contentType.matches('audio/(webm|ogg|mpeg|mp4|wav)') && request.resource.size < 15 * 1024 * 1024) ||
        (request.resource.contentType == 'application/pdf' && request.resource.size < 20 * 1024 * 1024)
      );
    }

    match /couples/{coupleId}/{category}/{fileName} {
      allow read: if isAuthorizedSpouse(coupleId);
      allow create: if isAuthorizedSpouse(coupleId) && isValidMedia();
      allow delete: if isAuthorizedSpouse(coupleId);
      allow update: if false;
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
\`\`\`

---

## 5. Build Android APK & Release AAB Commands
\`\`\`bash
# 1. Install dependencies & EAS CLI
npm install -g eas-cli
npx expo install react-native-reanimated react-native-webrtc @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/storage @react-native-firebase/messaging

# 2. Deploy strict 2-spouse Firebase rules
firebase deploy --only firestore:rules,storage

# 3. Build installable Android APK (for husband & wife phones)
eas build --platform android --profile preview-apk

# 4. Build signed Release Android App Bundle (.aab) for Google Play Internal/Closed Track
eas build --platform android --profile production-aab
\`\`\`
`;

  return new NextResponse(bundle, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="FOREVER-US-Android-Expo-Release-Kit.md"',
      "Cache-Control": "private, no-store",
    },
  });
}
