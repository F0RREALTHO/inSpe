declare module 'react-native-get-sms-android' {
  interface SmsFilter {
    box?: 'inbox' | 'sent' | 'draft' | 'outbox' | 'failed' | 'queued';
    maxCount?: number;
    sort?: 'date' | 'date_sent';
    order?: 'ASC' | 'DESC';
  }

  interface SmsMessage {
    address: string;
    body: string;
    date: number;
    dateSent?: number;
  }

  const SmsAndroid: {
    list: (
      filterJson: string,
      fail: (error: string) => void,
      success: (count: number, smsList: string) => void
    ) => void;
    delete: (
      id: number,
      fail: (error: string) => void,
      success: (success: boolean) => void
    ) => void;
  };

  export default SmsAndroid;
}

