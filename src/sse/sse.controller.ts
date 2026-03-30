import {
    Controller,
    Param,
    Sse,
    UseGuards,
    NotFoundException,
    Request,
    MessageEvent,
    Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { Observable, interval, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { GrpcExecutorService } from '../grpc-executor/grpc-executor.service';
import { GrpcCallLogsService } from '../grpc-call-logs/grpc-call-logs.service';

@ApiTags('sse')
@Controller('sse')
export class SseController {
    constructor(
        private readonly grpcExecutorService: GrpcExecutorService,
        private readonly grpcCallLogsService: GrpcCallLogsService,
    ) {}

    @Sse('executions/:executionId')
    @UseGuards(JwtAuthGuard)
    @ApiCookieAuth('access_token')
    @Header('Access-Control-Allow-Origin', 'http://localhost:5173')
    @Header('Access-Control-Allow-Credentials', 'true')
    @Header('Cache-Control', 'no-cache, no-transform')
    @Header('Connection', 'keep-alive')
    @Header('X-Accel-Buffering', 'no')
    @ApiOperation({ summary: 'SSE stream for a specific gRPC execution (streaming)' })
    @ApiResponse({
        status: 200,
        description: 'Server-Sent Events stream for execution',
        content: { 'text/event-stream': {} },
    })
    executionStream(@Param('executionId') executionId: string): Observable<MessageEvent> {
        const stream = this.grpcExecutorService.getExecutionStream(executionId);
        if (!stream) {
            throw new NotFoundException(`No active execution with ID: ${executionId}`);
        }

        return stream.pipe(
            map((event: any) => ({
                data: JSON.stringify(event),
                type: event.type,
            })),
        ) as Observable<MessageEvent>;
    }

    @Sse('events')
    @UseGuards(JwtAuthGuard)
    @ApiCookieAuth('access_token')
    @Header('Access-Control-Allow-Origin', 'http://localhost:5173')
    @Header('Access-Control-Allow-Credentials', 'true')
    @Header('Cache-Control', 'no-cache, no-transform')
    @Header('Connection', 'keep-alive')
    @Header('X-Accel-Buffering', 'no')
    @ApiOperation({ summary: 'SSE stream for user notifications (business events)' })
    @ApiResponse({
        status: 200,
        description: 'Server-Sent Events for user notifications',
        content: { 'text/event-stream': {} },
    })
    userEvents(@Request() req: any): Observable<MessageEvent> {
        const hello$ = of({
            data: JSON.stringify({
                type: 'connected',
                timestamp: new Date().toISOString(),
                userId: req.user?.id,
            }),
            type: 'connected',
        });

        const ping$ = interval(10000).pipe(
            map(() => ({
                data: JSON.stringify({
                    type: 'ping',
                    timestamp: new Date().toISOString(),
                    userId: req.user?.id,
                }),
                type: 'ping',
            })),
        );

        return merge(hello$, ping$) as Observable<MessageEvent>;
    }

    @Sse('admin/grpc-calls')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MODERATOR, UserRole.ADMIN)
    @ApiCookieAuth('access_token')
    @Header('Access-Control-Allow-Origin', 'http://localhost:5173')
    @Header('Access-Control-Allow-Credentials', 'true')
    @Header('Cache-Control', 'no-cache, no-transform')
    @Header('Connection', 'keep-alive')
    @Header('X-Accel-Buffering', 'no')
    @ApiOperation({ summary: 'Admin SSE stream for real-time gRPC call logs monitoring (MODERATOR/ADMIN)' })
    @ApiResponse({
        status: 200,
        description: 'Server-Sent Events for admin monitoring',
        content: { 'text/event-stream': {} },
    })
    adminGrpcCallsStream(): Observable<MessageEvent> {
        const hello$ = of({
            data: JSON.stringify({
                type: 'connected',
                timestamp: new Date().toISOString(),
            }),
            type: 'connected',
        });

        const ping$ = interval(10000).pipe(
            map(() => ({
                data: JSON.stringify({
                    type: 'ping',
                    timestamp: new Date().toISOString(),
                }),
                type: 'ping',
            })),
        );

        const logs$ = this.grpcCallLogsService.logEvents$.pipe(
            map((log) => ({
                data: JSON.stringify({ type: 'grpc_call', log }),
                type: 'grpc_call',
            })),
        );

        return merge(hello$, logs$, ping$) as Observable<MessageEvent>;
    }
}