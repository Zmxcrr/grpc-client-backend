import { NestFactory } from '@nestjs/core';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
        console.error('FATAL: JWT_SECRET environment variable is not set in production mode. Exiting.');
        process.exit(1);
    }

    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.use(cookieParser());

    app.enableCors({
        origin: (origin, callback) => {
            const allowed = new Set([
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://[::1]:5173',
            ]);

            if (!origin || allowed.has(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`Origin ${origin} not allowed by CORS`), false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    const config = new DocumentBuilder()
        .setTitle('gRPC IDE API')
        .setDescription('REST API for gRPC IDE backend. GraphQL available at /graphql.')
        .setVersion('1.0')
        .addCookieAuth('access_token')
        .addTag('auth', 'Authentication endpoints')
        .addTag('proto', 'Proto schema upload/download')
        .addTag('grpc', 'gRPC execution endpoints')
        .addTag('sse', 'Server-Sent Events endpoints')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port);

    console.log(`Application running on port ${port}`);
    console.log(`Swagger UI: http://localhost:${port}/api`);
    console.log(`GraphQL: http://localhost:${port}/graphql`);
}

bootstrap();