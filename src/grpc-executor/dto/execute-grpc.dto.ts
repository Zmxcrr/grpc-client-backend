import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsAllowedTargetHost } from '../validators/target-host.validator';

export class ExecuteGrpcDto {
  @ApiProperty({ example: 'uuid-of-proto-schema' })
  @IsString()
  protoId: string;

  @ApiProperty({ example: 'MyService' })
  @IsString()
  serviceName: string;

  @ApiProperty({ example: 'GetUser' })
  @IsString()
  methodName: string;

  @ApiProperty({ example: 'example.com:50051', description: 'Remote gRPC server host:port. Local/private addresses are blocked by default.' })
  @IsString()
  @IsNotEmpty()
  @IsAllowedTargetHost()
  targetHost: string;

  @ApiPropertyOptional({ example: { 'Authorization': 'Bearer token' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiPropertyOptional({ example: { id: '123' } })
  @IsOptional()
  @IsObject()
  requestBody?: Record<string, any>;

  @ApiPropertyOptional({ example: 'env-uuid' })
  @IsOptional()
  @IsString()
  environmentId?: string;
}
