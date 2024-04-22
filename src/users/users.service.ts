import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { UserEntity } from './entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@unifygpt.ai/utilities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}
  create(createUserDto: CreateUserDto) {
    const data = this.userRepository.create({});
    return this.userRepository.save(data);
  }

  findAll() {
    return this.userRepository.findAndCount();
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

 async update(id: string, updateUserDto: UpdateUserDto) {
     await this.userRepository.update(id, {});
     return this.userRepository.findOne({
       where : {id: id}
     })
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
