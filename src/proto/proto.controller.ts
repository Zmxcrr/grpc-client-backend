import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProtoService } from './proto.service';
import { UploadProtoDto } from './dto/upload-proto.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

@ApiTags('proto')
@Controller('proto')
export class ProtoController {
  constructor(private readonly protoService: ProtoService) {}

  @Post('upload')
  @UseGuards(new JwtAuthGuard(new Reflector()))
  @ApiCookieAuth('access_token')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a .proto file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Proto schema uploaded successfully' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadProtoDto,
    @Request() req: any,
  ) {
    return this.protoService.upload(file, dto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all proto schemas (summary)' })
  @ApiResponse({ status: 200, description: 'List of proto schemas' })
  async findAll() {
    const protos = await this.protoService.findAll();
    return protos.map(p => ({ id: p.id, name: p.name, filename: p.filename, createdAt: p.createdAt }));
  }

  @Get(':id/content')
  @UseGuards(new JwtAuthGuard(new Reflector()))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Download proto file content' })
  async getContent(@Param('id') id: string) {
    const content = await this.protoService.getProtoContent(id);
    return { content };
  }

  @Delete(':id')
  @UseGuards(new JwtAuthGuard(new Reflector()))
  @ApiCookieAuth('access_token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a proto schema' })
  @ApiResponse({ status: 204, description: 'Proto schema deleted' })
  async delete(@Param('id') id: string) {
    await this.protoService.delete(id);
  }
}
