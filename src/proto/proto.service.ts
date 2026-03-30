import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ProtoSchema } from './entities/proto-schema.entity';
import { UploadProtoDto } from './dto/upload-proto.dto';

export interface ProtoField {
  name: string;
  type: string;
  typeName?: string;
  repeated: boolean;
  required: boolean;
  fields?: ProtoField[];
  enumValues?: string[];
}

export interface ProtoMessage {
  name: string;
  fields: ProtoField[];
}

export interface ProtoMethod {
  name: string;
  requestType: string;
  responseType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
  inputFields: ProtoField[];
  outputFields: ProtoField[];
}

export interface ProtoServiceInfo {
  name: string;
  methods: ProtoMethod[];
}

export interface ProtoTree {
  id: string;
  name: string;
  filename: string;
  packageName?: string;
  services: ProtoServiceInfo[];
}

@Injectable()
export class ProtoService {
  constructor(
    @InjectRepository(ProtoSchema)
    private readonly protoRepository: Repository<ProtoSchema>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async upload(
    file: Express.Multer.File,
    dto: UploadProtoDto,
    userId?: string,
  ): Promise<ProtoSchema> {
    if (!file.originalname.endsWith('.proto')) {
      throw new BadRequestException('Only .proto files are allowed');
    }

    const proto = this.protoRepository.create({
      name: dto.name,
      description: dto.description,
      content: file.buffer.toString('utf-8'),
      filename: file.originalname,
      uploadedById: userId,
    });

    const saved = await this.protoRepository.save(proto);
    await this.cacheManager.del(`proto:${saved.id}`);
    await this.cacheManager.del('proto:list');
    return saved;
  }

  async findAll(): Promise<ProtoSchema[]> {
    const cached = await this.cacheManager.get<ProtoSchema[]>('proto:list');
    if (cached) return cached;
    const list = await this.protoRepository.find({ order: { createdAt: 'DESC' } });
    await this.cacheManager.set('proto:list', list, 30000);
    return list;
  }

  async findById(id: string): Promise<ProtoSchema> {
    const proto = await this.protoRepository.findOne({ where: { id } });
    if (!proto) throw new NotFoundException(`Proto schema ${id} not found`);
    return proto;
  }

  async delete(id: string): Promise<void> {
    const proto = await this.findById(id);
    await this.protoRepository.remove(proto);
    await this.cacheManager.del(`proto:${id}`);
    await this.cacheManager.del(`proto:tree:${id}`);
    await this.cacheManager.del('proto:list');
  }

  async getProtoTree(id: string): Promise<ProtoTree> {
    const cacheKey = `proto:tree:${id}`;
    const cached = await this.cacheManager.get<ProtoTree>(cacheKey);
    if (cached) return cached;

    const proto = await this.findById(id);
    const tree = await this.parseProto(proto);
    await this.cacheManager.set(cacheKey, tree, 300000);
    return tree;
  }

  async getProtoContent(id: string): Promise<string> {
    const proto = await this.findById(id);
    return proto.content;
  }

  private async parseProto(proto: ProtoSchema): Promise<ProtoTree> {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `proto_${uuidv4()}.proto`);
    
    try {
      fs.writeFileSync(tmpFile, proto.content);

      const packageDef = await protoLoader.load(tmpFile, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const services: ProtoServiceInfo[] = [];
      let packageName: string | undefined;

      const packageMatch = proto.content.match(/^package\s+([^\s;]+)/m);
      if (packageMatch) packageName = packageMatch[1];

      for (const [key, value] of Object.entries(packageDef)) {
        if (value && typeof value === 'object' && 'format' in (value as any)) {
          continue;
        }
        
        const parts = key.split('.');
        const serviceName = parts[parts.length - 1];
        
        if (value && typeof value === 'object') {
          const methods: ProtoMethod[] = [];
          
          for (const [methodName, methodDef] of Object.entries(value as any)) {
            if (methodDef && typeof methodDef === 'object' && 'requestStream' in (methodDef as any)) {
              const md = methodDef as any;
              const inputFields = this.extractFields(md.requestType?.type?.field || []);
              const outputFields = this.extractFields(md.responseType?.type?.field || []);
              
              methods.push({
                name: methodName,
                requestType: md.requestType?.type?.name || 'Unknown',
                responseType: md.responseType?.type?.name || 'Unknown',
                clientStreaming: md.requestStream || false,
                serverStreaming: md.responseStream || false,
                inputFields,
                outputFields,
              });
            }
          }
          
          if (methods.length > 0) {
            services.push({ name: serviceName, methods });
          }
        }
      }

      return {
        id: proto.id,
        name: proto.name,
        filename: proto.filename,
        packageName,
        services,
      };
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  }

  private extractFields(fields: any[]): ProtoField[] {
    if (!Array.isArray(fields)) return [];
    return fields.map((f) => ({
      name: f.name || '',
      type: f.type || 'string',
      typeName: f.typeName,
      repeated: f.rule === 'repeated',
      required: f.rule === 'required',
    }));
  }
}
