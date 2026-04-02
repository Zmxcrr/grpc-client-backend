import { Test, TestingModule } from '@nestjs/testing';
import { SseController } from './sse.controller';
import { GrpcExecutorService, ExecutionSession } from '../grpc-executor/grpc-executor.service';
import { GrpcCallLogsService } from '../grpc-call-logs/grpc-call-logs.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/enums/user-role.enum';
import { ReplaySubject } from 'rxjs';

function buildSession(overrides: Partial<ExecutionSession> = {}): ExecutionSession {
  return {
    executionId: 'exec-1',
    ownerUserId: 'owner-user-id',
    subject: new ReplaySubject(50),
    status: 'RUNNING',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SseController – executionStream', () => {
  let controller: SseController;
  let grpcExecutorService: { getExecutionSession: jest.Mock };
  let grpcCallLogsService: { logEvents$: any };

  beforeEach(async () => {
    grpcExecutorService = { getExecutionSession: jest.fn() };
    grpcCallLogsService = { logEvents$: new ReplaySubject() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SseController],
      providers: [
        { provide: GrpcExecutorService, useValue: grpcExecutorService },
        { provide: GrpcCallLogsService, useValue: grpcCallLogsService },
      ],
    }).compile();

    controller = module.get<SseController>(SseController);
  });

  it('throws NotFoundException for unknown executionId', () => {
    grpcExecutorService.getExecutionSession.mockReturnValue(undefined);

    expect(() =>
      controller.executionStream('non-existent', { user: { id: 'u1', role: UserRole.USER } }),
    ).toThrow(NotFoundException);
  });

  it('throws ForbiddenException when requester is not the owner and not privileged', () => {
    grpcExecutorService.getExecutionSession.mockReturnValue(
      buildSession({ ownerUserId: 'owner-user-id' }),
    );

    expect(() =>
      controller.executionStream('exec-1', { user: { id: 'other-user', role: UserRole.USER } }),
    ).toThrow(ForbiddenException);
  });

  it('allows owner to access their own execution stream', () => {
    const session = buildSession({ ownerUserId: 'owner-user-id' });
    grpcExecutorService.getExecutionSession.mockReturnValue(session);

    const result = controller.executionStream('exec-1', {
      user: { id: 'owner-user-id', role: UserRole.USER },
    });

    expect(result).toBeDefined();
    // Expect an observable (has subscribe method)
    expect(typeof result.subscribe).toBe('function');
  });

  it('allows MODERATOR to access any execution stream', () => {
    const session = buildSession({ ownerUserId: 'owner-user-id' });
    grpcExecutorService.getExecutionSession.mockReturnValue(session);

    const result = controller.executionStream('exec-1', {
      user: { id: 'moderator-id', role: UserRole.MODERATOR },
    });

    expect(result).toBeDefined();
  });

  it('allows ADMIN to access any execution stream', () => {
    const session = buildSession({ ownerUserId: 'owner-user-id' });
    grpcExecutorService.getExecutionSession.mockReturnValue(session);

    const result = controller.executionStream('exec-1', {
      user: { id: 'admin-id', role: UserRole.ADMIN },
    });

    expect(result).toBeDefined();
  });

  it('throws ForbiddenException for PREMIUM user accessing someone else\'s stream', () => {
    grpcExecutorService.getExecutionSession.mockReturnValue(
      buildSession({ ownerUserId: 'owner-user-id' }),
    );

    expect(() =>
      controller.executionStream('exec-1', { user: { id: 'premium-user', role: UserRole.PREMIUM } }),
    ).toThrow(ForbiddenException);
  });
});
