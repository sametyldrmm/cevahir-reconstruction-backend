// Queue isimleri - Her servis için benzersiz olmalı
export enum QueueNames {
  MY_SERVICE_QUEUE = 'my-service-queue',
  NOTIFICATION_QUEUE = 'notification-queue',
  TEST1_QUEUE = 'test1-queue',
  TEST2_QUEUE = 'test2-queue',
  LIVE_TRACKING_QUEUE = 'live-tracking-queue',
  LIVE_TRACKING_DB_QUEUE = 'live-tracking-db-queue',
  // ... diğer queue'lar
}

// Job tipleri - Her servis için özel
export enum MyServiceJobTypes {
  PROCESS_DATA = 'process-data',
  SEND_EMAIL = 'send-email',
  GENERATE_REPORT = 'generate-report',
}

// Test1 Queue Job Types
export enum Test1JobTypes {
  PROCESS_TASK = 'process-task',
  CALCULATE_SUM = 'calculate-sum',
  GENERATE_RANDOM = 'generate-random',
}

// Test2 Queue Job Types
export enum Test2JobTypes {
  SEND_NOTIFICATION = 'send-notification',
  LOG_MESSAGE = 'log-message',
  DELAYED_TASK = 'delayed-task',
}

// Live Tracking Queue Job Types
export enum LiveTrackingJobTypes {
  PROCESS_GPS_POINT = 'process-gps-point',
  PROCESS_ROUTE_BATCH = 'process-route-batch',
}

// Base Job Types - Tüm servislerde ortak
export enum BaseJobTypes {
  HEALTH_CHECK = 'health-check',
}

// Queue Configuration
export const QueueConfig = {
  defaultJobOptions: {
    removeOnComplete: 10, // Tamamlanan job'ları 10 adet tut
    removeOnFail: 5, // Başarısız job'ları 5 adet tut
    attempts: 3, // 3 kez dene
    backoff: {
      type: 'exponential' as const, // Exponential backoff
      delay: 2000, // 2 saniye başlangıç gecikmesi
    },
  },
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
};

// Job Data Interfaces
export interface BaseJobData {
  id: string;
  timestamp: Date;
  source: string;
  priority?: number; // 0-10 (10 = en yüksek öncelik)
}

export interface ProcessDataJobData extends BaseJobData {
  data: any;
  operation: string;
}

export interface EmailJobData extends BaseJobData {
  recipient: string;
  subject: string;
  body: string;
}

// Test1 Job Data Interfaces
export interface ProcessTaskJobData extends BaseJobData {
  taskName: string;
  parameters: Record<string, any>;
}

export interface CalculateSumJobData extends BaseJobData {
  numbers: number[];
}

export interface GenerateRandomJobData extends BaseJobData {
  min: number;
  max: number;
  count: number;
}

// Test2 Job Data Interfaces
export interface SendNotificationJobData extends BaseJobData {
  message: string;
  recipient: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface LogMessageJobData extends BaseJobData {
  message: string;
  level: 'debug' | 'info' | 'warn' | 'error';
}

export interface DelayedTaskJobData extends BaseJobData {
  task: string;
  delaySeconds: number;
}

// Live Tracking Job Data Interfaces
export interface ProcessGpsPointJobData extends BaseJobData {
  vehicleId: string;
  lat: number;
  lon: number;
  gpsTimestamp: number;
  speed?: number | null;
  ingestMode?: 'live' | 'history_replay';
  replayBatchId?: string;
  replayFrom?: number;
  replayTo?: number;
  replayClearRange?: boolean;
  suppressSocket?: boolean;
}

export interface ProcessRouteBatchJobData extends BaseJobData {
  vehicleId: string;
}

// Live Tracking DB Write Job Data
export interface LiveTrackingDbWriteJobData extends BaseJobData {
  vehicleId: string;
  lat: number;
  lon: number;
  gpsTimestamp: number;
  speed?: number | null;
}

// Job Result Interface
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  processedAt: Date;
}
