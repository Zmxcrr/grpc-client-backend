import { Test, TestingModule } from '@nestjs/testing';
import { GrpcExecutorService, ExecutionSession } from './grpc-executor.service';
import { ProtoService } from '../proto/proto.service';
import { HistoryService } from '../history/history.service';
import { GrpcCallLogsService } from '../grpc-call-logs/grpc-call-logs.service';
import { ReplaySubject } from 'rxjs';

const mockProtoService = { getProtoContent: jest.fn() };
const mockHistoryService = { create: jest.fn().mockResolvedValue({}) };
const mockCallLogsService = { create: jest.fn().mockResolvedValue({}) };

describe('GrpcExecutorService – stream session lifecycle', () => {
  let service: GrpcExecutorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrpcExecutorService,
        { provide: ProtoService, useValue: mockProtoService },
        { provide: HistoryService, useValue: mockHistoryService },
        { provide: GrpcCallLogsService, useValue: mockCallLogsService },
      ],
    }).compile();

    service = module.get<GrpcExecutorService>(GrpcExecutorService);
  });

  describe('startStreamExecution', () => {
    it('creates a session with PENDING status', async () => {
      // Prevent actual runStreamExecution from running (needs proto)
      jest.spyOn(service as any, 'runStreamExecution').mockResolvedValue(undefined);

      const userId = 'user-abc';
      const executionId = await service.startStreamExecution(
        { protoId: 'p1', serviceName: 'S', methodName: 'm', targetHost: 'example.com:50051' },
        userId,
      );

      const session = service.getExecutionSession(executionId);
      expect(session).toBeDefined();
      expect(session!.executionId).toBe(executionId);
      expect(session!.ownerUserId).toBe(userId);
      expect(session!.status).toBe('PENDING');
      expect(session!.subject).toBeInstanceOf(ReplaySubject);
    });

    it('returns undefined for unknown executionId', () => {
      expect(service.getExecutionSession('non-existent-id')).toBeUndefined();
    });
  });

  describe('getExecutionSession – ownership', () => {
    it('exposes ownerUserId so callers can enforce access control', async () => {
      jest.spyOn(service as any, 'runStreamExecution').mockResolvedValue(undefined);

      const ownerId = 'owner-123';
      const executionId = await service.startStreamExecution(
        { protoId: 'p1', serviceName: 'S', methodName: 'm', targetHost: 'example.com:50051' },
        ownerId,
      );

      const session = service.getExecutionSession(executionId);
      expect(session!.ownerUserId).toBe(ownerId);
    });

    it('ownerUserId is undefined when started without userId', async () => {
      jest.spyOn(service as any, 'runStreamExecution').mockResolvedValue(undefined);

      const executionId = await service.startStreamExecution(
        { protoId: 'p1', serviceName: 'S', methodName: 'm', targetHost: 'example.com:50051' },
      );

      const session = service.getExecutionSession(executionId);
      expect(session!.ownerUserId).toBeUndefined();
    });
  });

  describe('scheduleCleanup', () => {
    it('removes session from map after retention window', async () => {
      jest.useFakeTimers();
      jest.spyOn(service as any, 'runStreamExecution').mockResolvedValue(undefined);

      const executionId = await service.startStreamExecution(
        { protoId: 'p1', serviceName: 'S', methodName: 'm', targetHost: 'example.com:50051' },
        'user-1',
      );

      const session = service.getExecutionSession(executionId)!;
      (service as any).scheduleCleanup(session);

      expect(service.getExecutionSession(executionId)).toBeDefined();

      // Advance past the default 5-minute retention window
      jest.advanceTimersByTime(DEFAULT_RETENTION_MS_FOR_TEST + 50);
      expect(service.getExecutionSession(executionId)).toBeUndefined();

      jest.useRealTimers();
    });
  });

  describe('executeUnary – error handling', () => {
    it('returns ERROR status and message when proto fetch fails', async () => {
      mockProtoService.getProtoContent.mockRejectedValueOnce(new Error('Proto not found'));

      const result = await service.executeUnary(
        { protoId: 'bad', serviceName: 'S', methodName: 'm', targetHost: 'example.com:50051' },
        'user-1',
      );

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Proto not found');
    });

    it('returns "Unknown error" when a non-Error is thrown', async () => {
      mockProtoService.getProtoContent.mockRejectedValueOnce('plain string error');

      const result = await service.executeUnary(
        { protoId: 'bad', serviceName: 'S', methodName: 'm', targetHost: 'example.com:50051' },
        'user-1',
      );

      expect(result.status).toBe('ERROR');
      expect(result.error).toBe('Unknown error');
    });
  });
});

/** Value used for the cleanup test (matches the default from the service) */
const DEFAULT_RETENTION_MS_FOR_TEST = 300_000;
