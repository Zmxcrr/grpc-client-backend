import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Environment } from './entities/environment.entity';
import { CreateEnvironmentInput } from './dto/create-environment.input';
import { UpdateEnvironmentInput } from './dto/update-environment.input';

@Injectable()
export class EnvironmentsService {
  constructor(
    @InjectRepository(Environment)
    private readonly envRepository: Repository<Environment>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateEnvironmentInput, userId: string): Promise<Environment> {
    const env = this.envRepository.create({ ...dto, userId });
    const saved = await this.envRepository.save(env);
    await this.cacheManager.del(`envs:${userId}`);
    return saved;
  }

  async findAllByUser(userId: string): Promise<Environment[]> {
    const cacheKey = `envs:${userId}`;
    const cached = await this.cacheManager.get<Environment[]>(cacheKey);
    if (cached) return cached;
    const envs = await this.envRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
    await this.cacheManager.set(cacheKey, envs, 30000);
    return envs;
  }

  async findById(id: string, userId: string): Promise<Environment> {
    const env = await this.envRepository.findOne({ where: { id } });
    if (!env) throw new NotFoundException('Environment not found');
    if (env.userId !== userId) throw new ForbiddenException('Not your environment');
    return env;
  }

  async update(id: string, dto: UpdateEnvironmentInput, userId: string): Promise<Environment> {
    const env = await this.findById(id, userId);
    Object.assign(env, dto);
    const saved = await this.envRepository.save(env);
    await this.cacheManager.del(`envs:${userId}`);
    return saved;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const env = await this.findById(id, userId);
    await this.envRepository.remove(env);
    await this.cacheManager.del(`envs:${userId}`);
    return true;
  }
}
