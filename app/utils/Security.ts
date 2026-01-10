import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

// --- 🔒 RATE LIMITER ---

type LimitType = 'AI_REQUEST' | 'PDF_UPLOAD' | 'TRANSACTION_ADD';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Window size in milliseconds
  errorMessage: string;
}

const LIMITS: Record<LimitType, RateLimitConfig> = {
  // 7 requests per minute
  AI_REQUEST: {
    maxRequests: 7,
    windowMs: 60 * 1000,
    errorMessage: "You're chatting too fast! Please wait a moment before sending more AI requests."
  },
  // 1 upload per 3 minutes
  PDF_UPLOAD: {
    maxRequests: 1,
    windowMs: 3 * 60 * 1000,
    errorMessage: "Please wait 3 minutes before uploading another bank statement."
  },
  // 30 transactions per minute (abuse prevention)
  TRANSACTION_ADD: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    errorMessage: "Transaction limit reached. Please slow down."
  }
};

const STORAGE_PREFIX = "RATE_LIMIT_";

// Interface for Dependency Injection (makes testing easier)
export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class RateLimiterService {
  private storage: StorageBackend;

  constructor(storage: StorageBackend) {
    this.storage = storage;
  }

  /**
   * Checks if an action is allowed based on rate limits.
   * Throws an error if the limit is exceeded.
   */
  async checkLimit(type: LimitType): Promise<void> {
    const key = `${STORAGE_PREFIX}${type}`;
    const now = Date.now();
    const config = LIMITS[type];

    try {
      const rawData = await this.storage.getItem(key);
      let timestamps: number[] = rawData ? JSON.parse(rawData) : [];

      // Filter out timestamps older than the window
      timestamps = timestamps.filter(ts => now - ts < config.windowMs);

      if (timestamps.length >= config.maxRequests) {
        // Calculate time remaining
        const oldest = timestamps[0];
        const waitTime = Math.ceil((config.windowMs - (now - oldest)) / 1000);

        throw new Error(`${config.errorMessage} (Try again in ${waitTime}s)`);
      }

      // Add current timestamp and save
      timestamps.push(now);
      await this.storage.setItem(key, JSON.stringify(timestamps));

    } catch (error: any) {
      // If it's our rate limit error, rethrow it
      if (error.message && error.message.includes(config.errorMessage)) {
        throw error;
      }
      // If storage fails, we default to allowing (fail-open) or logging error
      console.error("RateLimiter Error:", error);
    }
  }

  /**
   * Clears limits (useful for testing or manual reset)
   */
  async resetLimit(type: LimitType) {
    await this.storage.removeItem(`${STORAGE_PREFIX}${type}`);
  }
}

// Default instance uses real AsyncStorage
export const RateLimiter = new RateLimiterService({
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k)
});


// --- 🛡️ ZOD SCHEMAS ---

export const TransactionSchema = z.object({
  amount: z.number().positive("Amount must be positive").max(100000000, "Amount is too large"),
  description: z.string().trim().min(1, "Description is required").max(100, "Description too long"),
  category: z.string().optional(), // Can be validated against a known list if needed
});

export const ChatMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(200, "Message too long (max 200 chars)"),
  role: z.enum(['user', 'assistant', 'system'])
});

export const SmsTransactionSchema = z.object({
  amount: z.number().positive(),
  date: z.number(), // Timestamp
  body: z.string(),
  sender: z.string()
});


// --- 🧹 SANITIZER ---

export const Sanitizer = {
  /**
   * Removes potentially dangerous characters to prevent injection.
   * Allows basic punctuation but strips specific control chars or HTML-like tags.
   */
  sanitizeInput(input: string): string {
    if (!input) return "";

    // 1. Remove HTML tags
    let clean = input.replace(/<[^>]*>/g, '');

    // 2. Remove control characters (except newlines/tabs)
    // eslint-disable-next-line no-control-regex
    clean = clean.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // 3. Normalize quotes (optional, helps with JSON consistency)
    clean = clean.replace(/["']/g, '');

    return clean.trim();
  },

  sanitizeAmount(amount: any): number {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || !isFinite(parsed)) return 0;
    return Math.abs(parsed); // Ensure positive
  }
};
