import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RequestHistory } from './entities/request-history.entity';

export interface CreateHistoryDto {
  protoId: string;
  serviceName: string;
  methodName: string;
  targetHost: string;
  metadata?: Record<string, string>;
  requestBody?: Record<string, any>;
  response?: Record<string, any>;
  error?: string;
  durationMs: number;
  isStreaming: boolean;
  status: string;
  userId?: string;
}

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(RequestHistory)
    private readonly historyRepository: Repository<RequestHistory>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateHistoryDto): Promise<RequestHistory> {
    const entry = this.historyRepository.create(dto);
    const saved = await this.historyRepository.save(entry);
    if (dto.userId) await this.cacheManager.del(`history:${dto.userId}`);
    return saved;
  }

  async findAllByUser(userId: string, limit = 50): Promise<RequestHistory[]> {
    const cacheKey = `history:${userId}`;
    const cached = await this.cacheManager.get<RequestHistory[]>(cacheKey);
    if (cached) return cached;
    const history = await this.historyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    await this.cacheManager.set(cacheKey, history, 30000);
    return history;
  }

  async clearUserHistory(userId: string): Promise<boolean> {
    await this.historyRepository.delete({ userId });
    await this.cacheManager.del(`history:${userId}`);
    return true;
  }
}
