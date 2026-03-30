import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from './enums/user-role.enum';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) {}

    async create(createUserDto: CreateUserDto): Promise<User> {
        const existing = await this.usersRepository.findOne({
            where: [{ email: createUserDto.email }, { username: createUserDto.username }],
        });
        if (existing) {
            throw new ConflictException('Email or username already in use');
        }

        const passwordHash = await bcrypt.hash(createUserDto.password, 10);

        const user = this.usersRepository.create({
            email: createUserDto.email,
            username: createUserDto.username,
            passwordHash,
            role: createUserDto.role ?? UserRole.USER,
        });

        return this.usersRepository.save(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    async findById(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find();
    }

    async updateRole(id: string, role: UserRole): Promise<User> {
        const user = await this.findById(id);
        if (!user) throw new NotFoundException('User not found');
        user.role = role;
        return this.usersRepository.save(user);
    }

    async validatePassword(user: User, password: string): Promise<boolean> {
        return bcrypt.compare(password, user.passwordHash);
    }
}