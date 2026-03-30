import { Injectable, BadRequestException } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Subject } from 'rxjs';
import { ProtoService } from '../proto/proto.service';
import { HistoryService } from '../history/history.service';
import { GrpcCallLogsService } from '../grpc-call-logs/grpc-call-logs.service';
import { ExecuteGrpcDto } from './dto/execute-grpc.dto';

export interface ExecutionEvent {
  type: 'started' | 'message' | 'log' | 'end' | 'error' | 'ping';
  data?: any;
  message?: string;
  timestamp: string;
}

@Injectable()
export class GrpcExecutorService {
  private readonly activeStreams = new Map<string, Subject<ExecutionEvent>>();

  constructor(
    private readonly protoService: ProtoService,
    private readonly historyService: HistoryService,
    private readonly grpcCallLogsService: GrpcCallLogsService,
  ) {}

  async executeUnary(
    dto: ExecuteGrpcDto,
    userId?: string,
  ): Promise<{ status: string; durationMs: number; response?: any; error?: string }> {
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

      const response = await this.callUnary(client, dto.methodName, dto.requestBody || {}, metadata);
      const durationMs = Date.now() - startTime;

      await this.recordCall(dto, durationMs, 'SUCCESS', response, undefined, userId);

      return { status: 'SUCCESS', durationMs, response };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err.message || 'Unknown error';
      await this.recordCall(dto, durationMs, 'ERROR', undefined, errorMsg, userId);
      return { status: 'ERROR', durationMs, error: errorMsg };
    } finally {
      if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  }

  async startStreamExecution(dto: ExecuteGrpcDto, userId?: string): Promise<string> {
    const executionId = uuidv4();
    const subject = new Subject<ExecutionEvent>();
    this.activeStreams.set(executionId, subject);

    setImmediate(() => this.runStreamExecution(executionId, dto, userId));

    return executionId;
  }

  getExecutionStream(executionId: string): Subject<ExecutionEvent> | undefined {
    return this.activeStreams.get(executionId);
  }

  private async runStreamExecution(executionId: string, dto: ExecuteGrpcDto, userId?: string) {
    const subject = this.activeStreams.get(executionId);
    if (!subject) return;

    const startTime = Date.now();
    let tmpFile: string | null = null;

    subject.next({
      type: 'started',
      data: { executionId },
      timestamp: new Date().toISOString(),
    });

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

      const call = client[dto.methodName](dto.requestBody || {}, metadata);

      call.on('data', (data: any) => {
        subject.next({
          type: 'message',
          data,
          timestamp: new Date().toISOString(),
        });
      });

      call.on('status', (status: any) => {
        subject.next({
          type: 'log',
          message: `Stream status: ${status.code}`,
          timestamp: new Date().toISOString(),
        });
      });

      call.on('error', (err: any) => {
        subject.next({
          type: 'error',
          message: err.message,
          timestamp: new Date().toISOString(),
        });
        subject.complete();
        this.activeStreams.delete(executionId);
      });

      call.on('end', async () => {
        const durationMs = Date.now() - startTime;
        await this.recordCall(dto, durationMs, 'SUCCESS', undefined, undefined, userId, true);
        subject.next({
          type: 'end',
          data: { durationMs },
          timestamp: new Date().toISOString(),
        });
        subject.complete();
        this.activeStreams.delete(executionId);
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      await this.recordCall(dto, durationMs, 'ERROR', undefined, err.message, userId, true);
      subject.next({
        type: 'error',
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      subject.complete();
      this.activeStreams.delete(executionId);
    } finally {
      if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  }

  private async writeTempProto(content: string, _id: string): Promise<string> {
    const tmpFile = path.join(os.tmpdir(), `exec_proto_${uuidv4()}.proto`);
    fs.writeFileSync(tmpFile, content);
    return tmpFile;
  }

  private findService(proto: any, serviceName: string): any {
    if (proto[serviceName]) return proto[serviceName];
    for (const key of Object.keys(proto)) {
      if (proto[key] && typeof proto[key] === 'object' && proto[key][serviceName]) {
        return proto[key][serviceName];
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

  private callUnary(client: any, methodName: string, request: any, metadata: grpc.Metadata): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!client[methodName]) {
        return reject(new Error(`Method ${methodName} not found on service`));
      }
      client[methodName](request, metadata, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response);
      });
    });
  }

  private async recordCall(
    dto: ExecuteGrpcDto,
    durationMs: number,
    status: string,
    response?: any,
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
