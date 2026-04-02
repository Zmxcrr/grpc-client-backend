import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GrpcExecutorService } from './grpc-executor.service';
import { ExecuteGrpcDto } from './dto/execute-grpc.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('grpc')
@Controller('grpc')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth('access_token')
export class GrpcExecutorController {
  constructor(private readonly grpcExecutorService: GrpcExecutorService) {}

  @Post('execute')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a unary gRPC call' })
  @ApiResponse({ status: 200, description: 'gRPC call result with status, durationMs, response or error' })
  async execute(@Body() dto: ExecuteGrpcDto, @Request() req: any) {
    return this.grpcExecutorService.executeUnary(dto, req.user?.id);
  }

  @Post('execute-stream')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a server-streaming gRPC call, returns executionId for SSE' })
  @ApiResponse({ status: 200, description: 'Returns executionId to subscribe via SSE' })
  async executeStream(@Body() dto: ExecuteGrpcDto, @Request() req: any) {
    const executionId = await this.grpcExecutorService.startStreamExecution(dto, req.user?.id);
    return { executionId };
  }
}
