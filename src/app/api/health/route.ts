import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEnvironment } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { performanceMonitor } from "@/lib/performance";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const healthChecks = {
      timestamp: new Date().toISOString(),
      uptime: (globalThis as any).process?.uptime?.() || 0,
      environment: (globalThis as any).process?.env?.NODE_ENV || 'unknown',
      version: '1.0.0',
      checks: {
        database: false,
        environment: false,
        performance: false,
        memory: false,
      },
      details: {} as Record<string, any>,
    };

    // Check environment variables
    const envValidation = validateEnvironment();
    healthChecks.checks.environment = envValidation.isValid;
    healthChecks.details.environment = {
      isValid: envValidation.isValid,
      errors: envValidation.errors,
    };

    // Check database connection
    try {
      await db.execute('SELECT 1');
      healthChecks.checks.database = true;
      healthChecks.details.database = {
        status: 'connected',
        message: 'Database connection successful',
      };
    } catch (error) {
      healthChecks.checks.database = false;
      healthChecks.details.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
      logger.error('Health check: Database connection failed', { error });
    }

    // Check performance monitoring
    try {
      const report = performanceMonitor.getReport();
      healthChecks.checks.performance = true;
      healthChecks.details.performance = {
        totalMetrics: report.metrics.length,
        averageResponseTime: report.summary.averageResponseTime,
        totalRequests: report.summary.totalRequests,
      };
    } catch (error) {
      healthChecks.checks.performance = false;
      healthChecks.details.performance = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Performance monitoring failed',
      };
    }

    // Check memory usage (if available)
    try {
      if (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.memoryUsage) {
        const memoryUsage = (globalThis as any).process.memoryUsage();
        healthChecks.checks.memory = true;
        healthChecks.details.memory = {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        };
      } else {
        healthChecks.checks.memory = true;
        healthChecks.details.memory = {
          message: 'Memory usage not available in this environment',
        };
      }
    } catch (error) {
      healthChecks.checks.memory = false;
      healthChecks.details.memory = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Memory check failed',
      };
    }

    // Calculate overall health
    const allChecks = Object.values(healthChecks.checks);
    const healthyChecks = allChecks.filter(check => check === true).length;
    const overallHealth = healthyChecks === allChecks.length ? 'healthy' : 'degraded';

    const responseTime = Date.now() - startTime;
    
    const response = {
      status: overallHealth,
      ...healthChecks,
      responseTime,
    };

    // Log health check
    logger.info('Health check completed', {
      status: overallHealth,
      responseTime,
      checks: healthChecks.checks,
    });

    return NextResponse.json(response, {
      status: overallHealth === 'healthy' ? 200 : 503,
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Health check failed', { error, responseTime });
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
        responseTime,
      },
      { status: 500 }
    );
  }
}

// Detailed health check endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { detailed = false } = body;

    const healthCheck = await GET(req);
    const healthData = await healthCheck.json();

    if (detailed) {
      // Add detailed system information
      const detailedHealth = {
        ...healthData,
        system: {
          platform: (globalThis as any).process?.platform || 'unknown',
          arch: (globalThis as any).process?.arch || 'unknown',
          nodeVersion: (globalThis as any).process?.version || 'unknown',
          pid: (globalThis as any).process?.pid || 0,
        },
        services: {
          // Add service-specific health checks here
          pdfProcessing: true, // Would check PDF processing service
          vectorDatabase: true, // Would check Pinecone
          fileStorage: true, // Would check S3
          aiService: true, // Would check OpenAI
        },
      };

      return NextResponse.json(detailedHealth);
    }

    return healthCheck;
  } catch (error) {
    logger.error('Detailed health check failed', { error });
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to perform detailed health check',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}