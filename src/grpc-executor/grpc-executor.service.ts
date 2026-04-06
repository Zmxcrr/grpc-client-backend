import { Injectable, BadRequestException } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ReplaySubject } from 'rxjs';
import { ProtoService } from '../proto/proto.service';
import { HistoryService } from '../history/history.service';
import { GrpcCallLogsService } from '../grpc-call-logs/grpc-call-logs.service';
import { ExecuteGrpcDto } from './dto/execute-grpc.dto';

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'ENDED' | 'ERROR' | 'TIMED_OUT';

export interface ExecutionEvent {
    type: 'started' | 'message' | 'log' | 'end' | 'error' | 'ping';
    data?: unknown;
    message?: string;
    timestamp: string;
}

export interface ExecutionSession {
    executionId: string;
    ownerUserId: string | undefined;
    subject: ReplaySubject<ExecutionEvent>;
    status: ExecutionStatus;
    createdAt: Date;
    updatedAt: Date;
    terminalEvent?: ExecutionEvent;
    cleanupTimer?: ReturnType<typeof setTimeout>;
    timeoutTimer?: ReturnType<typeof setTimeout>;
}

const DEFAULT_EXECUTION_TIMEOUT_MS = Number(process.env.GRPC_EXEC_TIMEOUT_MS ?? 120_000);

const DEFAULT_RETENTION_MS = Number(process.env.GRPC_EXEC_RETENTION_MS ?? 300_000);

@Injectable()
export class GrpcExecutorService {
    private readonly sessions = new Map<string, ExecutionSession>();

    constructor(
        private readonly protoService: ProtoService,
        private readonly historyService: HistoryService,
        private readonly grpcCallLogsService: GrpcCallLogsService,
    ) {}

    async executeUnary(
        dto: ExecuteGrpcDto,
        userId?: string,
    ): Promise<{ status: string; durationMs: number; response?: unknown; error?: string }> {
        console.log('TARGET:', dto.targetHost);
        const startTime = Date.now();
        let tmpFile: string | null = null;

        try {
            const protoContent = await this.protoService.getProtoContent(dto.protoId);
            tmpFile = await this.writeTempProto(protoContent, dto.protoId);

            const packageDef = await protoLoader.load(tmpFile, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
            });

            const proto = grpc.loadPackageDefinition(packageDef);
            const ServiceClass = this.findService(proto, dto.serviceName);

            if (!ServiceClass) {
                throw new BadRequestException(`Service ${dto.serviceName} not found in proto`);
            }

            const credentials = grpc.credentials.createInsecure();
            const client = new ServiceClass(dto.targetHost, credentials);
            const metadata = this.buildMetadata(dto.metadata);

            const response = await this.callUnary(client, dto.methodName, dto.requestBody ?? {}, metadata);
            const durationMs = Date.now() - startTime;

            await this.recordCall(dto, durationMs, 'SUCCESS', response, undefined, userId);

            return { status: 'SUCCESS', durationMs, response };
        } catch (err) {
            const durationMs = Date.now() - startTime;
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            await this.recordCall(dto, durationMs, 'ERROR', undefined, errorMsg, userId);
            return { status: 'ERROR', durationMs, error: errorMsg };
        } finally {
            if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    }

    async startStreamExecution(dto: ExecuteGrpcDto, userId?: string): Promise<string> {
        const executionId = uuidv4();
        const subject = new ReplaySubject<ExecutionEvent>(50);

        const session: ExecutionSession = {
            executionId,
            ownerUserId: userId,
            subject,
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.sessions.set(executionId, session);

        setImmediate(() => this.runStreamExecution(executionId, dto, userId));

        return executionId;
    }

    getExecutionSession(executionId: string): ExecutionSession | undefined {
        return this.sessions.get(executionId);
    }

    private updateSessionStatus(session: ExecutionSession, status: ExecutionStatus): void {
        session.status = status;
        session.updatedAt = new Date();
    }

    private scheduleCleanup(session: ExecutionSession): void {
        if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
        session.cleanupTimer = setTimeout(() => {
            this.sessions.delete(session.executionId);
        }, DEFAULT_RETENTION_MS).unref();
    }

    private async runStreamExecution(executionId: string, dto: ExecuteGrpcDto, userId?: string) {
        const session = this.sessions.get(executionId);
        if (!session) return;

        const { subject } = session;
        const startTime = Date.now();
        let tmpFile: string | null = null;
        let grpcCall: any;

        this.updateSessionStatus(session, 'RUNNING');

        subject.next({
            type: 'started',
            data: { executionId },
            timestamp: new Date().toISOString(),
        });

        session.timeoutTimer = setTimeout(async () => {
            if (session.status !== 'RUNNING') return;
            try {
                grpcCall?.cancel?.();
            } catch {
            }
            const timeoutEvent: ExecutionEvent = {
                type: 'error',
                message: `Execution timed out after ${DEFAULT_EXECUTION_TIMEOUT_MS}ms`,
                timestamp: new Date().toISOString(),
            };
            session.terminalEvent = timeoutEvent;
            this.updateSessionStatus(session, 'TIMED_OUT');
            subject.next(timeoutEvent);
            subject.complete();
            this.scheduleCleanup(session);
            const durationMs = Date.now() - startTime;
            await this.recordCall(dto, durationMs, 'ERROR', undefined, timeoutEvent.message, userId, true);
        }, DEFAULT_EXECUTION_TIMEOUT_MS).unref();

        try {
            const protoContent = await this.protoService.getProtoContent(dto.protoId);
            tmpFile = await this.writeTempProto(protoContent, dto.protoId);

            const packageDef = await protoLoader.load(tmpFile, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
            });

            const proto = grpc.loadPackageDefinition(packageDef);
            const ServiceClass = this.findService(proto, dto.serviceName);

            if (!ServiceClass) {
                throw new Error(`Service ${dto.serviceName} not found in proto`);
            }

            const credentials = grpc.credentials.createInsecure();
            const client = new ServiceClass(dto.targetHost, credentials);
            const metadata = this.buildMetadata(dto.metadata);

            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dto.methodName)) {
                throw new Error(`Invalid method name: ${dto.methodName}`);
            }
            grpcCall = client[dto.methodName](dto.requestBody ?? {}, metadata);

            grpcCall.on('data', (data: unknown) => {
                subject.next({
                    type: 'message',
                    data,
                    timestamp: new Date().toISOString(),
                });
            });

            grpcCall.on('status', (status: { code: number | string }) => {
                subject.next({
                    type: 'log',
                    message: `Stream status: ${status.code}`,
                    timestamp: new Date().toISOString(),
                });
            });

            grpcCall.on('error', async (err: unknown) => {
                if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
                if (session.status === 'TIMED_OUT') return;
                const errorMsg = err instanceof Error ? err.message : 'Stream error';
                const errorEvent: ExecutionEvent = {
                    type: 'error',
                    message: errorMsg,
                    timestamp: new Date().toISOString(),
                };
                session.terminalEvent = errorEvent;
                this.updateSessionStatus(session, 'ERROR');
                subject.next(errorEvent);
                subject.complete();
                this.scheduleCleanup(session);
                const durationMs = Date.now() - startTime;
                await this.recordCall(dto, durationMs, 'ERROR', undefined, errorMsg, userId, true);
            });

            grpcCall.on('end', async () => {
                if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
                // Ignore if the timeout handler already closed this session
                if (session.status === 'TIMED_OUT') return;
                const durationMs = Date.now() - startTime;
                await this.recordCall(dto, durationMs, 'SUCCESS', undefined, undefined, userId, true);
                const endEvent: ExecutionEvent = {
                    type: 'end',
                    data: { durationMs },
                    timestamp: new Date().toISOString(),
                };
                session.terminalEvent = endEvent;
                this.updateSessionStatus(session, 'ENDED');
                subject.next(endEvent);
                subject.complete();
                this.scheduleCleanup(session);
            });
        } catch (err) {
            if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
            const durationMs = Date.now() - startTime;
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            await this.recordCall(dto, durationMs, 'ERROR', undefined, errorMsg, userId, true);
            const errorEvent: ExecutionEvent = {
                type: 'error',
                message: errorMsg,
                timestamp: new Date().toISOString(),
            };
            session.terminalEvent = errorEvent;
            this.updateSessionStatus(session, 'ERROR');
            subject.next(errorEvent);
            subject.complete();
            this.scheduleCleanup(session);
        } finally {
            if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    }

    private async writeTempProto(content: string, _id: string): Promise<string> {
        const tmpFile = path.join(os.tmpdir(), `exec_proto_${uuidv4()}.proto`);
        fs.writeFileSync(tmpFile, content);
        return tmpFile;
    }

    private findService(proto: grpc.GrpcObject, serviceName: string): any {
        if (proto[serviceName]) return proto[serviceName];
        for (const key of Object.keys(proto)) {
            const pkg = proto[key];
            if (pkg && typeof pkg === 'object' && (pkg as grpc.GrpcObject)[serviceName]) {
                return (pkg as grpc.GrpcObject)[serviceName];
            }
        }
        return null;
    }

    private buildMetadata(metadata?: Record<string, string>): grpc.Metadata {
        const md = new grpc.Metadata();
        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
                md.add(key, value);
            }
        }
        return md;
    }

    private callUnary(client: any, methodName: string, request: unknown, metadata: grpc.Metadata): Promise<unknown> {
        return new Promise((resolve, reject) => {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(methodName)) {
                return reject(new Error(`Invalid method name: ${methodName}`));
            }
            if (typeof client[methodName] !== 'function') {
                return reject(new Error(`Method ${methodName} not found on service`));
            }
            client[methodName](request, metadata, (err: unknown, response: unknown) => {
                if (err) return reject(err);
                resolve(response);
            });
        });
    }

    private async recordCall(
        dto: ExecuteGrpcDto,
        durationMs: number,
        status: string,
        response?: unknown,
        error?: string,
        userId?: string,
        isStreaming = false,
    ) {
        await Promise.all([
            this.historyService.create({
                protoId: dto.protoId,
                serviceName: dto.serviceName,
                methodName: dto.methodName,
                targetHost: dto.targetHost,
                metadata: dto.metadata,
                requestBody: dto.requestBody,
                response,
                error,
                durationMs,
                isStreaming,
                status,
                userId,
            }),
            this.grpcCallLogsService.create({
                protoId: dto.protoId,
                serviceName: dto.serviceName,
                methodName: dto.methodName,
                targetHost: dto.targetHost,
                status,
                error,
                latencyMs: durationMs,
                userId,
            }),
        ]);
    }
}