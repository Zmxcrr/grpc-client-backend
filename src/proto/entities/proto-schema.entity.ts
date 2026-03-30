import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

@ObjectType()
@Entity('proto_schemas')
export class ProtoSchema {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description: string;

  @Column('text')
  content: string;

  @Field()
  @Column()
  filename: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  packageName: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  uploadedBy: User;

  @Column({ nullable: true })
  uploadedById: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
