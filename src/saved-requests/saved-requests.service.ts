import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SavedRequest } from './entities/saved-request.entity';
import { CreateSavedRequestInput } from './dto/create-saved-request.input';
import { UpdateSavedRequestInput } from './dto/update-saved-request.input';

@Injectable()
export class SavedRequestsService {
  constructor(
    @InjectRepository(SavedRequest)
    private readonly savedRequestsRepository: Repository<SavedRequest>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateSavedRequestInput, userId: string): Promise<SavedRequest> {
    const savedRequest = this.savedRequestsRepository.create({ ...dto, userId });
    const saved = await this.savedRequestsRepository.save(savedRequest);
    await this.cacheManager.del(`saved_requests:${userId}`);
    return saved;
  }

  async findAllByUser(userId: string): Promise<SavedRequest[]> {
    const cacheKey = `saved_requests:${userId}`;
    const cached = await this.cacheManager.get<SavedRequest[]>(cacheKey);
    if (cached) return cached;
    const requests = await this.savedRequestsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    await this.cacheManager.set(cacheKey, requests, 30000);
    return requests;
  }

  async findById(id: string, userId: string): Promise<SavedRequest> {
    const request = await this.savedRequestsRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Saved request not found');
    if (request.userId !== userId) throw new ForbiddenException('Not your saved request');
    return request;
  }

  async findByCollection(collectionId: string, userId: string): Promise<SavedRequest[]> {
    return this.savedRequestsRepository.find({
      where: { collectionId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateSavedRequestInput, userId: string): Promise<SavedRequest> {
    const request = await this.findById(id, userId);
    Object.assign(request, dto);
    const saved = await this.savedRequestsRepository.save(request);
    await this.cacheManager.del(`saved_requests:${userId}`);
    return saved;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const request = await this.findById(id, userId);
    await this.savedRequestsRepository.remove(request);
    await this.cacheManager.del(`saved_requests:${userId}`);
    return true;
  }
}
