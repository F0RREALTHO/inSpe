/// <reference types="react" />
/// <reference types="react-native" />

import * as React from "react";

declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface IntrinsicAttributes extends React.Attributes {}
  }

  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_URL?: string;
    }
  }
}

// 👇 ADD THIS TO FIX EXPO-FILE-SYSTEM ERRORS
declare module 'expo-file-system' {
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  
  export enum EncodingType {
    UTF8 = 'utf8',
    BASE64 = 'base64',
  }

  export interface WritingOptions {
    encoding?: EncodingType | string;
  }

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: WritingOptions
  ): Promise<void>;

  export function readAsStringAsync(
    fileUri: string,
    options?: WritingOptions
  ): Promise<string>;
}

// 👇 ADD THIS TO FIX EXPO-DOCUMENT-PICKER ERRORS (If needed)
declare module 'expo-document-picker' {
    export interface DocumentPickerAsset {
        uri: string;
        name: string;
        size?: number;
        mimeType?: string;
    }
    export interface DocumentPickerResult {
        canceled: boolean;
        assets: DocumentPickerAsset[] | null;
    }
    export function getDocumentAsync(options?: any): Promise<DocumentPickerResult>;
}

export {};