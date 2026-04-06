import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { GrpcCallLog } from './entities/grpc-call-log.entity';
import { Subject } from 'rxjs';

export interface CreateGrpcCallLogDto {
  serviceName: string;
  methodName: string;
  targetHost: string;
  status: string;
  error?: string;
  latencyMs: number;
  userId?: string;
  protoId: string;
}

@Injectable()
export class GrpcCallLogsService {
  private readonly logStream$ = new Subject<GrpcCallLog>();
  public readonly logEvents$ = this.logStream$.asObservable();

  constructor(
    @InjectRepository(GrpcCallLog)
    private readonly logsRepository: Repository<GrpcCallLog>,
  ) {}

  async create(dto: CreateGrpcCallLogDto): Promise<GrpcCallLog> {
    const log = this.logsRepository.create(dto);
    const saved = await this.logsRepository.save(log);
    this.logStream$.next(saved);
    return saved;
  }

  async findAll(options?: { limit?: number; offset?: number; status?: string }): Promise<GrpcCallLog[]> {
    const findOptions: FindManyOptions<GrpcCallLog> = {
      order: { createdAt: 'DESC' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
    };
    if (options?.status) {
      findOptions.where = { status: options.status };
    }
    return this.logsRepository.find(findOptions);
  }

  async countTotal(): Promise<number> {
    return this.logsRepository.count();
  }
}
