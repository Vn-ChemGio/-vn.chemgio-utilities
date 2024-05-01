import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, } from '@nestjs/common';
import { AuditLogsService } from '@unifygpt.ai/utilities';
import { AuthenticateGuard } from './auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthenticateGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogsService: AuditLogsService,
  ) {
  }
  
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
  
  @Get()
  async findAll() {
    const assetTypeAttributes = [
      {
        'UIControlDefaultValue': '',
        'UIControlListValue': [],
        'UIControlType': 'text_field',
        'createdAt': '2024-04-23T08:00:07.897Z',
        'createdBy': 'email|65bb214dd6fb03501fca9c4b',
        'digitalAssetTypeId': '6da5739f-fdce-4bbc-97c3-c037c33b366c',
        'fieldName': 'address',
        'fieldType': 'string',
        'id': '2cd9c688-b81f-40b5-8ef9-ed191b566af8',
        'isRequired': false,
        'isUnique': false,
        'updatedAt': '2024-04-23T08:00:07.897Z',
        'updatedBy': 'NULL',
        'validationPattern': ''
      }
    ];
    
    
    const res = await this.auditLogsService.logBulk(
      assetTypeAttributes.map((assetTypeAttribute) => ({
        
        message: 'Create new Digital Asset Type Attribute',
        status: 'COMPLETED',
      })),
    );
    return res;
  }
  
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }
  
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }
  
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
