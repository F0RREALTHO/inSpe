# InSpend

## 📱 App Overview
**InSpend** is a feature-rich, local-first personal finance tracker built with **React Native (Expo)** and **Firebase**. It emphasizes speed, visual feedback, and automation (SMS scanning, AI categorization) to make expense tracking effortless.

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

## 🚀 Detailed Implementation & Core Features

### 1. 🏠 Dashboard & Home
- **Dynamic Header:**
    - Calculates & displays **total balance** (Income - Expense).
    - **"Safe-to-Spend"** metric: Auto-calculates remaining budget after subtracting *fixed* recurring costs for the month.
    - **Time-based Greeting**: "Good Morning/Afternoon/Evening" with username.
    - **Animated Blast Button**: Central action button with particle effects (`CircularBlastButton`) to quickly add transactions.
- **Quick Stats**:
    - **Cards**: "Income", "Expense", "Savings" cards with icons and distinct colors.
    - **Upcoming Bills**: `UpcomingCard` shows the *next* recurring payment date (handles daily/weekly/monthly logic).
    - **Monthly Progress**: Visual progress bar showing budget utilization.
- **Components Implemented**:
    - `Skeleton`: Loading states for smoother UX.
    - `TimeOfDayBadge`: Visual badge for greeting.
    - `PulsingCat`: Novelty animated cat component.

### 2. 💸 Transaction Management (`add.tsx`)
- **Add Screen**:
    - **Custom Number Pad**: `NumberEntry` component with haptic feedback.
    - **Category Selector**: Grid of categories with emojis and colors.
    - **Date Picker**: Native date picker integration.
    - **Recurring Toggle**: Option to set transaction as Daily, Weekly, or Monthly.
    - **AI Auto-Categorization**: Uses `AICategorizationService` (Groq API) to predict category based on note/description.
- **History (`history.tsx`)**:
    - **Grouped List**: Transactions grouped by Date (Today, Yesterday, etc.).
    - **Search**: Real-time filtering by note, category, or amount.
    - **Edit/Delete**: Long-press or swipe actions to manage records.

### 3. 🐷 Savings Goals (`SavingsWidget.tsx`)
- **Goal Management**:
    - **Create Goal**: Name, Target Amount, Emoji selector.
    - **Visual Progress**: ProgressBar showing `%` saved.
    - **"Lock" Fund**: Move money *out* of spendable balance into a locked goal.
    - **"Purchase" Goal**: When ready to spend, "Unlock" funds. Option to record as **Cash** (no digital trace) or **Digital** (match with bank transaction).
    - **Withdraw**: Move funds back to main balance if needed.
    - **Prediction**: "New Balance" preview when typing amount.

### 4. 📊 Insights & Analytics (`insights.tsx`)
- **Charts**:
    - **Compare**: Income vs. Expense toggle.
    - **Timeframes**: Week, Month, Year views.
    - **Interactive Bars**: Tap bars to see exact amounts (`SpringBar` component).
- **AI Analyst (Axiom)**:
    - **Chat Interface**: Conversational AI that analyzes spending habits.
    - **Smart Summaries**: "Burn Rate" prediction (e.g., "At this rate, you'll run out of budget in 12 days").
- **Reports**:
    - **HTML/PDF Generator**: `htmlGenerator.ts` compiles data into a styled report.
    - **Share**: Integrated system share sheet to export PDF.

### 5. ⚙️ Settings & Customization
- **Categories (`categories.tsx`)**:
    - **CRUD**: Create, Read, Update, Delete custom categories.
    - **Attributes**: Custom Emoji & Color picker.
    - **Defaults**: Pre-loaded essential categories (Food, Transport, Rent etc.).
- **Notifications (`notifications.tsx`)**:
    - **Reminders**: Daily reminders to log expenses.
    - **Threshold Alerts**: "You've spent 80% of your budget!"
- **Profile (`profilemanagement.tsx`)**:
    - Edit Name, Monthly Limit.
    - **Budget Style**: "Strict", "Flexible" (affects AI advice tone).
    - **Insights Level**: "Minimal", "Detailed" or "AI" mode.
- **Appearance**:
    - **Theme Engine**: Complete Light/Dark mode support (`ThemeContext`, `themes.ts`).
    - **Haptics**: Toggle vibration feedback on/off.

### 6. 🛠️ Utilities & Technical "Minute Things"
- **Automation**:
    - **SMS Parsing (`smsParser.ts`)**: (Android) background listener reads bank SMS to auto-create transactions.
    - **Bank Statement Parser**: Parses text-based bank statements.
- **Security (`Security.ts`)**:
    - **Biometric Lock**: `AuthProtection.tsx` / `BiometricAuth.tsx` for app entry.
    - **Rate Limiting**: Prevents API abuse (AI, PDF generation).
    - **Input Sanitization**: Cleanses text inputs to prevent errors/injection.
- **Data Handling**:
    - **CSV Import/Export (`CsvService.ts`)**: Backup data or move to Excel.
    - **Budget Rollover (`BudgetRollover.ts`)**: Logic to carry forward unused budget to next month.
    - **Firebase Sync**: Real-time Firestore sync with offline persistence.
- **UI UX Polish**:
    - **Custom Toasts**: `CustomToast.tsx` for non-intrusive alerts.
    - **Animations**: Heavy use of `react-native-reanimated` (Layout transitions, Modal entries).
    - **Currency Formatting**: Helper `formatCurrency.ts` for Indian Rupee consistency (₹xx,xxx).

## 🛠️ The Tech Stack
*   **Framework**: [React Native (Expo)](https://expo.dev) 
*   **Language**: TypeScript
*   **Backend / DB**: Firebase (Firestore, Auth)
*   **AI Engine**: Groq API (Llama-3 70B)
*   **State**: React Context + optimistic updates
*   **Storage**: MMKV / AsyncStorage for instant load times

## 📦 Download the App

<p align="center">
  <a href="https://drive.google.com/file/d/1kMce5tKifu0Oo1H54Qoh-5qjPcV7QomQ/view">
    <img src="https://img.shields.io/badge/Download-APK-success?style=for-the-badge&logo=android">
  </a>
</p>

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Expo CLI (`npm install -g expo-cli`)

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
---

## 👨‍💻 Creators

<p>
  <a href="https://github.com/Shree-Pastagia"><b>Shree Pastagia</b></a>  
  &nbsp;•&nbsp;  
  <a href="https://github.com/F0RREALTHO"><b>Kartikeya Aryam</b></a>
</p>

---

<p align="center">
  <small>Built with ❤️ & ☕</small>
</p>
