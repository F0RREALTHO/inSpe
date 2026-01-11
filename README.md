# 💳 InSpend - Cyberpunk Finance Tracker

> **"Your Money. Your Rules. Zero Friction."**

InSpend is not just another expense tracker. It is a **Financial Defense System** built for the modern spender. Combining automated tracking, behavioral psychology, and a premium "Cyberpunk" aesthetic, InSpend helps you master your finances without the boring spreadsheets.

![InSpend Banner](https://via.placeholder.com/1200x600?text=InSpend+App+Preview)

## ⚡ Why InSpend? (The "Wow" Factor)

Most finance apps are manual and boring. **InSpend is alive.**

*   **🤖 Auto-Pilot Tracking**: Listens for transaction SMS (Android) in the background and instantly records expenses. No manual entry required.
*   **📄 Intelligent PDF Parser**: Drop in your bank statement (PDF). We strip the junk, clean merchant names, and organize everything automatically.
*   **🧠 AI-Powered Context**: Powered by **Groq (Llama-3)**, InSpend understands that "Ravi Medicos" is *Health*, not *General*. It learns your habits.

## 🛡️ Financial Defense System

We use behavioral psychology to stop you from going broke.

*   **🔒 Impulse Control & Goal Locking**: Savings goals are **LOCKED** inside a vault. You cannot spend that money unless you strictly "Unlock" it (adding friction to impulse buys).
*   **📉 Budget Rescue Engine**: Overspent in January? The deficit is *automatically deducted* from February's budget. You can't cheat the system.
*   **👆 Biometric Fortress**: Integrated with FaceID / Fingerprint. The app creates a secure session that locks immediately when minimized.

## 🎨 Premium "Obsidian" Experience

Finance doesn't have to be ugly.

*   **Neon & Glassmorphism**: High-end UI with translucent cards and neon glows in our signature **Obsidian Dark Mode**.
*   **Digital Daybreak**: A clean, sterile Apple-style Light Mode for the minimalists.
*   **Haptic Engineering**: Feel your finances. Distinct haptic feedback for success, warnings, and limits.
*   **Living UI**: Breathing skeletons, particle blasts on goal completion, and organic animations.

## 🛠️ The Tech Stack

Built for performance and offline-first reliability.

*   **Framework**: [React Native (Expo)](https://expo.dev) 
*   **Language**: TypeScript
*   **Backend / DB**: Firebase (Firestore, Auth)
*   **AI Engine**: Groq API (Llama-3 70B)
*   **State**: React Context + optimistic updates
*   **Storage**: MMKV / AsyncStorage for instant load times

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18+)
*   Expo CLI (`npm install -g expo-cli`)
*   Android Studio / Xcode (for simulators)

### Installation

1.  **Clone the repo**
    ```bash
    git clone https://github.com/yourusername/inspend.git
    cd inspend
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file with your keys:
    ```env
    EXPO_PUBLIC_FIREBASE_API_KEY=your_key
    EXPO_PUBLIC_GROQ_KEYS=your_groq_keys
    ```

4.  **Run the App**
    ```bash
    npx expo start
    ```

## 📱 Features at a Glance

| Feature | Description |
| :--- | :--- |
| **Safe-to-Spend** | Calculates exact disposable income after bills & savings. |
| **Rollover** | Unused budget rolls over to the next month. |
| **Spending Profiles** | Adapts to **Impulsive**, **Balanced**, or **Planner** personalities. |
| **Privacy First** | Data processing happens locally or via secure, ephemeral AI calls. |

---

<p align="center">
  <small>Built with ❤️ & ☕ </small>
</p>
