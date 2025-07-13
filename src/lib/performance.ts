export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    totalRequests: number;
    averageResponseTime: number;
    slowestRequest: PerformanceMetric | null;
    fastestRequest: PerformanceMetric | null;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  // Track a performance metric
  track(name: string, duration: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Keep only the last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  // Measure execution time of a function
  async measure<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.track(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.track(`${name}_error`, duration, { ...metadata, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // Measure execution time of a synchronous function
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.track(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.track(`${name}_error`, duration, { ...metadata, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // Get performance report
  getReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        metrics: [],
        summary: {
          totalRequests: 0,
          averageResponseTime: 0,
          slowestRequest: null,
          fastestRequest: null,
        },
      };
    }

    const durations = this.metrics.map(m => m.duration);
    const totalRequests = this.metrics.length;
    const averageResponseTime = durations.reduce((a, b) => a + b, 0) / totalRequests;
    const slowestRequest = this.metrics.reduce((a, b) => a.duration > b.duration ? a : b);
    const fastestRequest = this.metrics.reduce((a, b) => a.duration < b.duration ? a : b);

    return {
      metrics: [...this.metrics],
      summary: {
        totalRequests,
        averageResponseTime,
        slowestRequest,
        fastestRequest,
      },
    };
  }

  // Get metrics by name
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name);
  }

  // Get metrics within a time range
  getMetricsInRange(startTime: number, endTime: number): PerformanceMetric[] {
    return this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  // Clear all metrics
  clear(): void {
    this.metrics = [];
  }

  // Get metrics summary by name
  getSummaryByName(name: string): {
    count: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
  } {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) {
      return { count: 0, averageDuration: 0, minDuration: 0, maxDuration: 0 };
    }

    const durations = metrics.map(m => m.duration);
    return {
      count: metrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / metrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
    };
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const trackPerformance = (name: string, duration: number, metadata?: Record<string, any>) => {
  performanceMonitor.track(name, duration, metadata);
};

export const measurePerformance = <T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> => {
  return performanceMonitor.measure(name, fn, metadata);
};

export const measurePerformanceSync = <T>(name: string, fn: () => T, metadata?: Record<string, any>): T => {
  return performanceMonitor.measureSync(name, fn, metadata);
};

// Performance decorators for API routes
export const withPerformanceTracking = (name: string) => {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return measurePerformance(name, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
};

// Performance tracking for specific operations
export const performanceTrackers = {
  // PDF processing
  pdfProcessing: (fileKey: string, fileSize: number) => ({
    name: 'pdf_processing',
    metadata: { fileKey, fileSize },
  }),

  // Vector upload
  vectorUpload: (fileKey: string, vectorCount: number) => ({
    name: 'vector_upload',
    metadata: { fileKey, vectorCount },
  }),

  // Chat message
  chatMessage: (chatId: number, messageLength: number) => ({
    name: 'chat_message',
    metadata: { chatId, messageLength },
  }),

  // Context retrieval
  contextRetrieval: (fileKey: string, queryLength: number) => ({
    name: 'context_retrieval',
    metadata: { fileKey, queryLength },
  }),

  // API calls
  apiCall: (endpoint: string, method: string) => ({
    name: 'api_call',
    metadata: { endpoint, method },
  }),

  // Database operations
  databaseOperation: (operation: string, table: string) => ({
    name: 'database_operation',
    metadata: { operation, table },
  }),
};

// Performance monitoring for React components
export const usePerformanceTracking = (componentName: string) => {
  const startTime = performance.now();

  return {
    end: (metadata?: Record<string, any>) => {
      const duration = performance.now() - startTime;
      trackPerformance(`${componentName}_render`, duration, metadata);
    },
  };
};

// Performance monitoring for network requests
export const trackNetworkRequest = async <T>(
  name: string,
  request: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  return measurePerformance(name, request, metadata);
};