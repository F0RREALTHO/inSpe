import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';


type LimitType = 'AI_REQUEST' | 'PDF_UPLOAD' | 'TRANSACTION_ADD';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Window size in milliseconds
  errorMessage: string;
}

const LIMITS: Record<LimitType, RateLimitConfig> = {
  AI_REQUEST: {
    maxRequests: 7,
    windowMs: 60 * 1000,
    errorMessage: "You're chatting too fast! Please wait a moment before sending more AI requests."
  },
  PDF_UPLOAD: {
    maxRequests: 2,
    windowMs: 3 * 60 * 1000,
    errorMessage: "Please wait 3 minutes before uploading another bank statement."
  },
  TRANSACTION_ADD: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    errorMessage: "Transaction limit reached. Please slow down."
  }
};

const STORAGE_PREFIX = "RATE_LIMIT_";

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

  async checkLimit(type: LimitType): Promise<void> {
    const key = `${STORAGE_PREFIX}${type}`;
    const now = Date.now();
    const config = LIMITS[type];

    try {
      const rawData = await this.storage.getItem(key);
      let timestamps: number[] = rawData ? JSON.parse(rawData) : [];

      timestamps = timestamps.filter(ts => now - ts < config.windowMs);

      if (timestamps.length >= config.maxRequests) {
        const oldest = timestamps[0];
        const waitTime = Math.ceil((config.windowMs - (now - oldest)) / 1000);

        throw new Error(`${config.errorMessage} (Try again in ${waitTime}s)`);
      }

      timestamps.push(now);
      await this.storage.setItem(key, JSON.stringify(timestamps));

    } catch (error: any) {
      if (error.message && error.message.includes(config.errorMessage)) {
        throw error;
      }
      console.error("RateLimiter Error:", error);
    }
  }

  async resetLimit(type: LimitType) {
    await this.storage.removeItem(`${STORAGE_PREFIX}${type}`);
  }
}

export const RateLimiter = new RateLimiterService({
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k)
});



export const TransactionSchema = z.object({
  amount: z.number().positive("Amount must be positive").max(100000000, "Amount is too large"),
  description: z.string().trim().min(1, "Description is required").max(100, "Description too long"),
  category: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(200, "Message too long (max 200 chars)"),
  role: z.enum(['user', 'assistant', 'system'])
});

export const SmsTransactionSchema = z.object({
  amount: z.number().positive(),
  date: z.number(),
  body: z.string(),
  sender: z.string()
});



export const Sanitizer = {
  sanitizeInput(input: string): string {
    if (!input) return "";

    let clean = input.replace(/<[^>]*>/g, '');

    clean = clean.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    clean = clean.replace(/["']/g, '');

    return clean.trim();
  },

  sanitizeAmount(amount: any): number {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || !isFinite(parsed)) return 0;
    return Math.abs(parsed);
  }
};
