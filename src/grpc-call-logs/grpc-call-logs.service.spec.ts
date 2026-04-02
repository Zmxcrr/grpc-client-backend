import { GrpcCallLogsService } from './grpc-call-logs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GrpcCallLog } from './entities/grpc-call-log.entity';
import { Test, TestingModule } from '@nestjs/testing';

describe('GrpcCallLogsService.findAll', () => {
  let service: GrpcCallLogsService;
  let findSpy: jest.Mock;

  beforeEach(async () => {
    findSpy = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrpcCallLogsService,
        {
          provide: getRepositoryToken(GrpcCallLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: findSpy,
            count: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<GrpcCallLogsService>(GrpcCallLogsService);
  });

  it('uses default limit of 50 when no options provided', async () => {
    await service.findAll();
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 }),
    );
  });

  it('uses default limit of 50 when limit is undefined', async () => {
    await service.findAll({ limit: undefined });
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 }),
    );
  });

  it('treats limit=0 as 0 (not defaulting to 50 due to ?? operator)', async () => {
    await service.findAll({ limit: 0, offset: 0 });
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ take: 0, skip: 0 }),
    );
  });

  it('uses provided limit', async () => {
    await service.findAll({ limit: 10 });
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it('treats offset=0 as 0 (not defaulting to 0 via ??)', async () => {
    await service.findAll({ offset: 0 });
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it('uses provided offset', async () => {
    await service.findAll({ offset: 20 });
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20 }),
    );
  });

  it('applies status filter when provided', async () => {
    await service.findAll({ status: 'ERROR' });
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ERROR' } }),
    );
  });
});
