import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CleanLogger } from './clean-logger';

type AuthedRequest = Request & { user?: { id?: string } };

@Injectable()
export class HttpRequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new CleanLogger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const method = req.method;
    const fullPath =
      typeof req.originalUrl === 'string' ? req.originalUrl : req.url ?? '';
    const path = fullPath.split('?')[0] || fullPath || '/';
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = http.getResponse<Response>();
          const ms = Date.now() - started;
          const line = this.formatLine(method, path, res.statusCode, ms, req.user?.id);
          this.logger.log(line);
        },
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - started;
        const status =
          err instanceof HttpException ? err.getStatus() : 500;
        this.logger.warn(this.formatLine(method, path, status, ms, req.user?.id));
        return throwError(() => err);
      }),
    );
  }

  /** METHOD path | status | ms [u=...] */
  private formatLine(
    method: string,
    path: string,
    status: number,
    ms: number,
    userId?: string,
  ): string {
    const u =
      userId && userId.length > 0 ? ` u=${userId.slice(0, 8)}` : '';
    return `${method} ${path} | ${status} | ${ms}ms${u}`;
  }
}
