import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RequestCollection } from './entities/request-collection.entity';
import { CreateCollectionInput } from './dto/create-collection.input';
import { UpdateCollectionInput } from './dto/update-collection.input';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(RequestCollection)
    private readonly collectionsRepository: Repository<RequestCollection>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateCollectionInput, userId: string): Promise<RequestCollection> {
    const collection = this.collectionsRepository.create({ ...dto, userId });
    const saved = await this.collectionsRepository.save(collection);
    await this.cacheManager.del(`collections:${userId}`);
    return saved;
  }

  async findAllByUser(userId: string): Promise<RequestCollection[]> {
    const cacheKey = `collections:${userId}`;
    const cached = await this.cacheManager.get<RequestCollection[]>(cacheKey);
    if (cached) return cached;
    const collections = await this.collectionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    await this.cacheManager.set(cacheKey, collections, 30000);
    return collections;
  }

  async findById(id: string, userId: string): Promise<RequestCollection> {
    const collection = await this.collectionsRepository.findOne({ where: { id } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.userId !== userId) throw new ForbiddenException('Not your collection');
    return collection;
  }

  async update(id: string, dto: UpdateCollectionInput, userId: string): Promise<RequestCollection> {
    const collection = await this.findById(id, userId);
    Object.assign(collection, dto);
    const saved = await this.collectionsRepository.save(collection);
    await this.cacheManager.del(`collections:${userId}`);
    return saved;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const collection = await this.findById(id, userId);
    await this.collectionsRepository.remove(collection);
    await this.cacheManager.del(`collections:${userId}`);
    return true;
  }
}
